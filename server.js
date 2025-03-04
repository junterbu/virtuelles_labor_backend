import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

// .env Datei laden
dotenv.config();

const corsOptions = {
    origin: "*", // Erlaube Anfragen von überall
    methods: "GET,POST,OPTIONS",
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

// Middleware für CORS, falls Vercel Header entfernt
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    next();
});

// Standard-Route für Root (/)
app.get("/", (req, res) => {
    res.json({ message: "Backend läuft erfolgreich auf Vercel! 🚀" });
});

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
            beantworteteRäume = docSnap.data().beantworteteRäume || [];
            quizPunkteNeu = docSnap.data().punkte || 0;
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
        res.set("Access-Control-Allow-Origin", "*"); // Sicherstellen, dass CORS-Header gesetzt sind
        const userId = req.params.userId;
        const docRef = db.collection("quizErgebnisse").doc(userId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ error: "Keine Daten gefunden" });
        }

        res.status(200).json(docSnap.data());
    } catch (error) {
        console.error("Fehler beim Abrufen der Daten:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Daten" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
