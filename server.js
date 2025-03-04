import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// .env Datei laden
dotenv.config();

const corsOptions = {
    origin: "*", // Erlaube Anfragen von überall, falls weiterhin CORS-Probleme bestehen
    methods: "GET,POST",
    allowedHeaders: "Content-Type"
};

// Firebase-Admin initialisieren, falls noch nicht initialisiert
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}

const db = getFirestore();
const app = express();
app.use(cors(corsOptions));
app.use(express.json());

// Test-Route für CORS-Probleme
app.get("/test", (req, res) => {
    res.json({ message: "CORS funktioniert!" });
});

// Route für das Speichern der Quiz-Daten
app.post("/api/quiz", async (req, res) => {
    try {
        const { userId, raum, auswahl } = req.body;
        const docRef = db.collection("quizErgebnisse").doc(userId);
        const docSnap = await docRef.get();

        let quizPunkteNeu = 0;
        let beantworteteRäume = [];

        if (docSnap.exists) {
            beantworteteRäume = docSnap.data().beantworteteRäume;
            quizPunkteNeu = docSnap.data().punkte;
        }

        if (!beantworteteRäume.includes(raum)) {
            const quizFragen = {
                "Gesteinsraum": { antwort: "Sie zeigt an, dass gesetzliche Vorschriften eingehalten wurden", punkte: 10 },
                "Mischer": { antwort: "Um die gesetzlichen Anforderungen an das Mischgut zu überprüfen", punkte: 10 },
                "Marshall": { antwort: "Durch Erstellen einer Polynomfunktion und Finden des Maximums", punkte: 10 }
            };

            if (quizFragen[raum]?.antwort === auswahl) {
                quizPunkteNeu += quizFragen[raum].punkte;
            }
            beantworteteRäume.push(raum);
        }

        await docRef.set({
            punkte: quizPunkteNeu,
            beantworteteRäume: beantworteteRäume
        });

        res.status(200).json({ message: "Quiz-Daten gespeichert!", punkte: quizPunkteNeu });
    } catch (error) {
        console.error("Fehler beim Speichern der Quiz-Daten:", error);
        res.status(500).json({ error: "Fehler beim Speichern der Quiz-Daten" });
    }
});

// Route für das Abrufen der Daten
app.get("/api/data/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const docRef = db.collection("quizErgebnisse").doc(userId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ error: "Keine Daten gefunden" });
        }

        res.set("Access-Control-Allow-Origin", "*"); // Manuelle CORS-Header setzen
        res.status(200).json(docSnap.data());
    } catch (error) {
        console.error("Fehler beim Abrufen der Daten:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Daten" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
