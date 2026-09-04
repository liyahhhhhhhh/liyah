const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;


/* =========================================================
   GET VISITOR IP
   ========================================================= */

function getClientIP(req) {

    const forwarded =
        req.headers["x-forwarded-for"];

    if (forwarded) {

        return forwarded
            .split(",")[0]
            .trim();

    }

    return req.socket.remoteAddress || "unknown";

}


/* =========================================================
   MASK IP
   ========================================================= */

function maskIP(ip) {

    if (!ip || ip === "unknown") {
        return "unknown";
    }

    /* IPv4 */

    if (ip.includes(".")) {

        const parts = ip.split(".");

        if (parts.length === 4) {

            return `${parts[0]}.${parts[1]}.${parts[2]}.***`;

        }

    }

    /* IPv6 */

    if (ip.includes(":")) {

        const parts = ip.split(":");

        if (parts.length > 2) {

            return (
                parts.slice(0, 3).join(":") +
                ":****"
            );

        }

    }

    return "masked";

}


/* =========================================================
   GET APPROXIMATE VISITOR LOCATION
   ========================================================= */

async function getVisitorLocation(ip) {

    if (
        !ip ||
        ip === "unknown" ||
        ip === "::1" ||
        ip === "127.0.0.1"
    ) {

        return {
            country: "Unknown",
            countryCode: null,
            region: "Unknown"
        };

    }


    try {

        const response = await fetch(
            `https://ipwho.is/${encodeURIComponent(ip)}`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json"
                }
            }
        );


        if (!response.ok) {

            console.error(
                "IP location lookup failed:",
                response.status
            );

            return {
                country: "Unknown",
                countryCode: null,
                region: "Unknown"
            };

        }


        const data =
            await response.json();


        if (!data.success) {

            return {
                country: "Unknown",
                countryCode: null,
                region: "Unknown"
            };

        }


        return {

            country:
                data.country ||
                "Unknown",

            countryCode:
                data.country_code ||
                null,

            region:
                data.region ||
                "Unknown"

        };


    } catch (error) {

        console.error(
            "Location lookup error:",
            error.message
        );


        return {

            country: "Unknown",

            countryCode: null,

            region: "Unknown"

        };

    }

}


/* =========================================================
   COUNTRY FLAG
   ========================================================= */

function countryFlag(countryCode) {

    if (
        !countryCode ||
        countryCode.length !== 2
    ) {

        return "🌍";

    }


    return countryCode
        .toUpperCase()
        .split("")
        .map(
            char =>
                String.fromCodePoint(
                    127397 +
                    char.charCodeAt(0)
                )
        )
        .join("");

}


/* =========================================================
   SEND VISIT NOTIFICATION
   ========================================================= */

async function sendDiscordVisitNotification(
    logEntry
) {

    if (!DISCORD_WEBHOOK_URL) {

        console.error(
            "DISCORD_WEBHOOK_URL is missing."
        );

        return;

    }


    try {

        const flag =
            countryFlag(
                logEntry.countryCode
            );


        const response =
            await fetch(
                DISCORD_WEBHOOK_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        username:
                            "Liyah's Hub Security",

                        embeds: [{

                            title:
                                "🌐 SITE VISIT",

                            fields: [

                                {
                                    name:
                                        "Location",

                                    value:
                                        `${flag} ${logEntry.country}`,

                                    inline: true
                                },

                                {
                                    name:
                                        "Region / State",

                                    value:
                                        `\`${logEntry.region}\``,

                                    inline: true
                                },

                                {
                                    name:
                                        "IP Address",

                                    value:
                                        `\`${logEntry.maskedIP}\``,

                                    inline: true
                                },

                                {
                                    name:
                                        "Time",

                                    value:
                                        `\`${logEntry.timestamp}\``,

                                    inline: true
                                },

                                {
                                    name:
                                        "Method",

                                    value:
                                        `\`${logEntry.method}\``,

                                    inline: true
                                },

                                {
                                    name:
                                        "Path",

                                    value:
                                        `\`${logEntry.path}\``,

                                    inline: true
                                },

                                {
                                    name:
                                        "User-Agent",

                                    value:
                                        `\`${logEntry.userAgent.slice(
                                            0,
                                            1000
                                        )}\``,

                                    inline: false
                                },

                                {
                                    name:
                                        "Referer",

                                    value:
                                        `\`${logEntry.referer.slice(
                                            0,
                                            1000
                                        )}\``,

                                    inline: false
                                }

                            ],

                            footer: {

                                text:
                                    "Liyah's Hub • Visitor Request Log"

                            },

                            timestamp:
                                logEntry.timestamp

                        }]

                    })

                }
            );


        if (!response.ok) {

            const errorText =
                await response.text();

            console.error(
                "Discord webhook error:",
                response.status,
                errorText
            );

        } else {

            console.log(
                "Discord visit notification sent."
            );

        }


    } catch (error) {

        console.error(
            "Webhook request failed:",
            error
        );

    }

}


/* =========================================================
   VISITOR LOGGING
   ========================================================= */

app.get(
    "/api/visit",
    async (req, res) => {

        const ip =
            getClientIP(req);


        /* =========================
           LOCATION
           ========================= */

        const location =
            await getVisitorLocation(ip);


        const logEntry = {

            timestamp:
                new Date().toISOString(),

            /*
             * Keep the complete IP only in server memory
             * long enough to perform the approximate
             * location lookup.
             */

            ip: ip,

            maskedIP:
                maskIP(ip),

            country:
                location.country,

            countryCode:
                location.countryCode,

            region:
                location.region,

            method:
                req.method,

            path:
                req.originalUrl,

            userAgent:
                req.headers["user-agent"] ||
                "unknown",

            referer:
                req.headers["referer"] ||
                "none"

        };


        console.log(
            "[SITE VISIT]",
            JSON.stringify({

                timestamp:
                    logEntry.timestamp,

                maskedIP:
                    logEntry.maskedIP,

                country:
                    logEntry.country,

                region:
                    logEntry.region,

                method:
                    logEntry.method,

                path:
                    logEntry.path

            })
        );


        await sendDiscordVisitNotification(
            logEntry
        );


        res.status(204).end();

    }
);


/* =========================================================
   DISCORD USER LOOKUP (bot token — basic profile)
   ========================================================= */

app.get(
    "/api/discord/:id",
    async (req, res) => {

        const userId =
            req.params.id;


        if (!DISCORD_BOT_TOKEN) {

            console.error(
                "DISCORD_BOT_TOKEN is missing."
            );

            return res
                .status(500)
                .json({
                    error:
                        "Discord bot token is not configured."
                });

        }


        if (!/^\d{17,20}$/.test(userId)) {

            return res
                .status(400)
                .json({
                    error:
                        "Invalid Discord ID."
                });

        }


        try {

            const response =
                await fetch(
                    `https://discord.com/api/v10/users/${userId}`,
                    {
                        method: "GET",

                        headers: {
                            Authorization:
                                `Bot ${DISCORD_BOT_TOKEN}`,

                            Accept:
                                "application/json"
                        }

                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                console.error(
                    "Discord API error:",
                    response.status,
                    data
                );


                if (
                    response.status === 401
                ) {

                    return res
                        .status(500)
                        .json({

                            error:
                                "Discord bot authentication failed. Check DISCORD_BOT_TOKEN in Render."

                        });

                }


                return res
                    .status(response.status)
                    .json({

                        error:
                            data.message ||
                            "Discord API error."

                    });

            }


            /* =========================
               DISCORD ACCOUNT CREATION
               ========================= */

            let createdAt = null;


            try {

                const DISCORD_EPOCH =
                    1420070400000;


                const timestamp =
                    Number(
                        BigInt(userId) >> 22n
                    ) +
                    DISCORD_EPOCH;


                createdAt =
                    new Date(
                        timestamp
                    ).toISOString();


            } catch (error) {

                createdAt = null;

            }


            /* =========================
               AVATAR
               ========================= */

            let avatarURL = null;


            if (data.avatar) {

                const extension =
                    data.avatar.startsWith("a_")
                        ? "gif"
                        : "png";


                avatarURL =
                    `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${extension}?size=512`;

            }


            if (!avatarURL) {

                const defaultAvatar =
                    Number(
                        data.discriminator || 0
                    ) % 5;


                avatarURL =
                    `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;

            }


            /* =========================
               BANNER
               ========================= */

            let bannerURL = null;


            if (data.banner) {

                const extension =
                    data.banner.startsWith("a_")
                        ? "gif"
                        : "png";


                bannerURL =
                    `https://cdn.discordapp.com/banners/${data.id}/${data.banner}.${extension}?size=1024`;

            }


            /* =========================
               AVATAR DECORATION
               ========================= */

            let avatarDecorationURL =
                null;


            if (
                data.avatar_decoration_data?.asset
            ) {

                avatarDecorationURL =
                    `https://cdn.discordapp.com/avatar-decoration-presets/${data.avatar_decoration_data.asset}.png?size=512`;

            }


            /* =========================
               RESPONSE
               ========================= */

            res.json({

                id:
                    data.id ||
                    null,

                username:
                    data.username ||
                    null,

                global_name:
                    data.global_name ||
                    null,

                discriminator:
                    data.discriminator ||
                    "0",

                bot:
                    data.bot === true,

                system:
                    data.system === true,

                avatar:
                    data.avatar ||
                    null,

                avatar_url:
                    avatarURL,

                avatar_decoration:
                    data.avatar_decoration_data ||
                    null,

                avatar_decoration_url:
                    avatarDecorationURL,

                banner:
                    data.banner ||
                    null,

                banner_url:
                    bannerURL,

                accent_color:
                    data.accent_color ??
                    null,

                public_flags:
                    data.public_flags ??
                    0,

                flags:
                    data.flags ??
                    0,

                created_at:
                    createdAt,

                account_created:
                    createdAt
                        ? new Date(
                            createdAt
                        ).toLocaleString(
                            "en-GB",
                            {
                                day:
                                    "2-digit",

                                month:
                                    "2-digit",

                                year:
                                    "numeric"
                            }
                        )
                        : null,

                raw:
                    data

            });


        } catch (error) {

            console.error(
                "Discord lookup error:",
                error
            );


            res
                .status(500)
                .json({
                    error:
                        "Failed to contact Discord."
                });

        }

    }
);


/* =========================================================
   DETECT QUERY TYPE
   ========================================================= */

function detectQueryType(q) {

    const s =
        q.trim();


    if (
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
    ) {

        return "email";

    }


    if (
        /^\+?[\d\s\-().]{7,20}$/.test(s) &&
        s.replace(/\D/g, "").length >= 7
    ) {

        return "phone";

    }


    if (
        /^\d{1,3}(\.\d{1,3}){3}$/.test(s)
    ) {

        return "ip";

    }


    if (
        /^\d{14,20}$/.test(s)
    ) {

        return "discord_id";

    }


    if (
        s.length >= 3
    ) {

        return "username";

    }


    return "unknown";

}


/* =========================================================
   BREACH LOOKUP
   LeakCheck public + XposedOrNot
   ========================================================= */

app.get(
    "/api/breach",
    async (req, res) => {

        const query =
            (req.query.q || "")
                .trim();


        if (
            !query ||
            query.length < 3
        ) {

            return res
                .status(400)
                .json({

                    error:
                        "Query too short. Min 3 characters."

                });

        }


        const type =
            detectQueryType(query);


        const sources = [];

        const fieldsSet =
            new Set();

        let found = 0;

        const notes = [];


        /* =========================
           LEAKCHECK PUBLIC
           ========================= */

        if (
            type === "email" ||
            type === "username" ||
            type === "phone"
        ) {

            try {

                const lcRes =
                    await fetch(
                        `https://leakcheck.io/api/public?check=${encodeURIComponent(query)}`,
                        {
                            headers: {
                                Accept:
                                    "application/json"
                            }
                        }
                    );


                if (lcRes.ok) {

                    const lc =
                        await lcRes.json();


                    if (
                        lc.success &&
                        lc.found > 0
                    ) {

                        found +=
                            lc.found;


                        (
                            lc.fields ||
                            []
                        ).forEach(
                            f =>
                                fieldsSet.add(f)
                        );


                        (
                            lc.sources ||
                            []
                        ).forEach(
                            s => {

                                sources.push({

                                    name:
                                        s.name ||
                                        "Unknown",

                                    date:
                                        s.date ||
                                        null,

                                    provider:
                                        "LeakCheck"

                                });

                            }
                        );

                    }

                } else {

                    notes.push(
                        `LeakCheck status ${lcRes.status}`
                    );

                }


            } catch (e) {

                console.error(
                    "LeakCheck error:",
                    e.message
                );


                notes.push(
                    "LeakCheck unreachable"
                );

            }

        }


        /* =========================
           XPOSEDORNOT
           ========================= */

        if (
            type === "email"
        ) {

            try {

                const xoRes =
                    await fetch(
                        `https://api.xposedornot.com/v1/check-email/${encodeURIComponent(query)}`,
                        {
                            headers: {
                                Accept:
                                    "application/json"
                            }
                        }
                    );


                if (xoRes.ok) {

                    const xo =
                        await xoRes.json();


                    if (
                        xo.status === "success" &&
                        Array.isArray(
                            xo.breaches
                        ) &&
                        xo.breaches.length
                    ) {

                        const list =
                            Array.isArray(
                                xo.breaches[0]
                            )
                                ? xo.breaches[0]
                                : xo.breaches;


                        list.forEach(
                            name => {

                                if (
                                    !sources.some(
                                        s =>
                                            s.name
                                                .toLowerCase() ===
                                            String(name)
                                                .toLowerCase()
                                    )
                                ) {

                                    sources.push({

                                        name:
                                            String(name),

                                        date:
                                            null,

                                        provider:
                                            "XposedOrNot"

                                    });

                                }

                            }
                        );


                        found =
                            Math.max(
                                found,
                                list.length
                            );

                    }

                } else if (
                    xoRes.status !== 404
                ) {

                    notes.push(
                        `XposedOrNot status ${xoRes.status}`
                    );

                }


            } catch (e) {

                console.error(
                    "XposedOrNot error:",
                    e.message
                );


                notes.push(
                    "XposedOrNot unreachable"
                );

            }

        }


        /* =========================
           DISCORD / IP NOTE
           ========================= */

        if (
            type === "discord_id" ||
            type === "ip"
        ) {

            notes.push(
                "Discord IDs and IPs are rarely present in public breach indexes. Use email, username or phone for better results."
            );

        }


        /* =========================
           RESPONSE
           ========================= */

        res.json({

            query,

            type,

            found:
                sources.length ||
                found,

            fields:
                Array.from(
                    fieldsSet
                ),

            sources,

            notes

        });

    }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Server running on port ${PORT}`
        );


        console.log(
            "Discord bot token:",
            DISCORD_BOT_TOKEN
                ? "CONFIGURED"
                : "MISSING"
        );


        console.log(
            "Discord webhook:",
            DISCORD_WEBHOOK_URL
                ? "CONFIGURED"
                : "MISSING"
        );

    }
);
