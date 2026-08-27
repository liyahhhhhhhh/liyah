const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;

const DISCORD_BOT_TOKEN =
    process.env.DISCORD_BOT_TOKEN;

const DISCORD_WEBHOOK_URL =
    process.env.DISCORD_WEBHOOK_URL;


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

    return req.socket.remoteAddress ||
        "unknown";
}


/* =========================================================
   SEND VISIT NOTIFICATION
   ========================================================= */

async function sendDiscordVisitNotification(logEntry) {

    if (!DISCORD_WEBHOOK_URL) {

        console.error(
            "DISCORD_WEBHOOK_URL is missing."
        );

        return;
    }

    try {

        const response = await fetch(
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

                    embeds: [

                        {
                            title:
                                "🌐 SITE VISIT",

                            fields: [

                                {
                                    name:
                                        "Time",

                                    value:
                                        `\`${logEntry.timestamp}\``,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Method",

                                    value:
                                        `\`${logEntry.method}\``,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "Path",

                                    value:
                                        `\`${logEntry.path}\``,

                                    inline:
                                        true
                                },

                                {
                                    name:
                                        "User-Agent",

                                    value:
                                        `\`${logEntry.userAgent.slice(0, 1000)}\``,

                                    inline:
                                        false
                                },

                                {
                                    name:
                                        "Referer",

                                    value:
                                        `\`${logEntry.referer.slice(0, 1000)}\``,

                                    inline:
                                        false
                                }

                            ],

                            footer: {

                                text:
                                    "IP address is retained in Render logs."

                            },

                            timestamp:
                                logEntry.timestamp
                        }

                    ]

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

app.get("/api/visit", async (req, res) => {

    const logEntry = {

        timestamp:
            new Date().toISOString(),

        ip:
            getClientIP(req),

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


    /* =====================================================
       PRIVATE RENDER SECURITY LOG
       ===================================================== */

    console.log(
        "[SITE VISIT]",
        JSON.stringify(logEntry)
    );


    /* =====================================================
       DISCORD NOTIFICATION
       ===================================================== */

    await sendDiscordVisitNotification(
        logEntry
    );


    res.status(204).end();

});


/* =========================================================
   DISCORD USER LOOKUP
   ========================================================= */

app.get(
    "/api/discord/:id",
    async (req, res) => {

        const userId =
            req.params.id;


        /* =================================================
           CHECK BOT TOKEN
           ================================================= */

        if (!DISCORD_BOT_TOKEN) {

            console.error(
                "DISCORD_BOT_TOKEN is missing."
            );

            return res.status(500).json({

                error:
                    "Discord bot token is not configured."

            });

        }


        /* =================================================
           CHECK DISCORD ID
           ================================================= */

        if (!/^\d{17,20}$/.test(userId)) {

            return res.status(400).json({

                error:
                    "Invalid Discord ID."

            });

        }


        try {

            /* =============================================
               DISCORD API REQUEST
               ============================================= */

            const response = await fetch(

                `https://discord.com/api/v10/users/${userId}`,

                {
                    method:
                        "GET",

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


            /* =============================================
               DISCORD API ERROR
               ============================================= */

            if (!response.ok) {

                console.error(
                    "Discord API error:",
                    response.status,
                    data
                );


                if (
                    response.status === 401
                ) {

                    return res.status(500).json({

                        error:
                            "Discord bot authentication failed. Check DISCORD_BOT_TOKEN in Render."

                    });

                }


                return res.status(
                    response.status
                ).json({

                    error:
                        data.message ||
                        "Discord API error."

                });

            }


            /* =================================================
               ACCOUNT CREATION DATE
               ================================================= */

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


            /* =================================================
               AVATAR URL
               ================================================= */

            let avatarURL = null;


            if (data.avatar) {

                const extension =
                    data.avatar.startsWith("a_")
                        ? "gif"
                        : "png";


                avatarURL =

                    `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.${extension}?size=512`;

            }


            /* =================================================
               DEFAULT AVATAR
               ================================================= */

            if (!avatarURL) {

                const defaultAvatar =
                    Number(
                        data.discriminator || 0
                    ) % 5;


                avatarURL =

                    `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;

            }


            /* =================================================
               BANNER URL
               ================================================= */

            let bannerURL = null;


            if (data.banner) {

                const extension =
                    data.banner.startsWith("a_")
                        ? "gif"
                        : "png";


                bannerURL =

                    `https://cdn.discordapp.com/banners/${data.id}/${data.banner}.${extension}?size=1024`;

            }


            /* =================================================
               AVATAR DECORATION
               ================================================= */

            let avatarDecorationURL =
                null;


            if (
                data.avatar_decoration_data?.asset
            ) {

                avatarDecorationURL =

                    `https://cdn.discordapp.com/avatar-decoration-presets/${data.avatar_decoration_data.asset}.png?size=512`;

            }


            /* =================================================
               RETURN PROFILE INFORMATION
               ================================================= */

            res.json({

                id:
                    data.id || null,

                username:
                    data.username || null,

                global_name:
                    data.global_name || null,

                discriminator:
                    data.discriminator || "0",

                bot:
                    data.bot === true,

                system:
                    data.system === true,

                avatar:
                    data.avatar || null,

                avatar_url:
                    avatarURL,

                avatar_decoration:
                    data.avatar_decoration_data ||
                    null,

                avatar_decoration_url:
                    avatarDecorationURL,

                banner:
                    data.banner || null,

                banner_url:
                    bannerURL,

                accent_color:
                    data.accent_color ?? null,

                public_flags:
                    data.public_flags ?? 0,

                flags:
                    data.flags ?? 0,

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


            res.status(500).json({

                error:
                    "Failed to contact Discord."

            });

        }

    }
);


/* =========================================================
   START SERVER
   ========================================================= */

app.listen(PORT, () => {

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

});
