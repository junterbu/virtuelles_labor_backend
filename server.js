import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./firebase-config.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Backend läuft! 🚀");
});

// API-Route zum Speichern von Daten in Firebase
app.post("/api/data", async (req, res) => {
    try {
        const { userId, data } = req.body;
        await db.collection("userData").doc(userId).set(data);
        res.status(200).json({ message: "Daten gespeichert!" });
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Speichern der Daten" });
    }
});

// API-Route zum Abrufen von Daten aus Firebase
app.get("/api/data/:userId", async (req, res) => {
    try {
        const doc = await db.collection("userData").doc(req.params.userId).get();
        if (!doc.exists) {
            return res.status(404).json({ error: "Keine Daten gefunden" });
        }
        res.status(200).json(doc.data());
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Abrufen der Daten" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
