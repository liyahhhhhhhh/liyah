const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

app.get("/api/discord/:id", async (req, res) => {

    const userId = req.params.id;

    if (!/^\d{17,20}$/.test(userId)) {
        return res.status(400).json({
            error: "Invalid Discord ID."
        });
    }

    try {

        const response = await fetch(
            `https://discord.com/api/v10/users/${userId}`,
            {
                headers: {
                    Authorization: `Bot ${DISCORD_BOT_TOKEN}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.message || "Discord API error."
            });
        }

        res.json(data);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Failed to contact Discord."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
