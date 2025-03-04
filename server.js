import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getFirestore, doc, getDoc, setDoc } from "firebase-admin/firestore";
import { initializeApp, applicationDefault } from "firebase-admin/app";

dotenv.config();

const corsOptions = {
    origin: "https://junterbu.github.io", // Erlaube nur Anfragen von deiner GitHub Pages-Seite
    methods: "GET,POST",
    allowedHeaders: "Content-Type"
};



const app = express();
app.use(cors(corsOptions));
app.use(express.json());

initializeApp({
    credential: applicationDefault(),
});

const db = getFirestore();

app.post("/api/quiz", async (req, res) => {
    try {
        const { userId, raum, auswahl } = req.body;
        const docRef = doc(db, "quizErgebnisse", userId);
        const docSnap = await getDoc(docRef);

        let quizPunkteNeu = 0;
        let beantworteteRäume = [];

        if (docSnap.exists()) {
            beantworteteRäume = docSnap.data().beantworteteRäume;
            quizPunkteNeu = docSnap.data().punkte;
        }

        if (!beantworteteRäume.includes(raum)) {
            const quizFragen = {
                "Gesteinsraum": { antwort: "Sie zeigt an, dass gesetzliche Vorschriften eingehalten wurden", punkte: 10 },
                "Mischer": { antwort: "Um die gesetzlichen Anforderungen an das Mischgut zu überprüfen", punkte: 10 },
                "Marshall": { antwort: "Durch Erstellen einer Polynomfunktion und Finden des Maximums", punkte: 10 }
            };

            if (quizFragen[raum].antwort === auswahl) {
                quizPunkteNeu += quizFragen[raum].punkte;
            }
            beantworteteRäume.push(raum);
        }

        await setDoc(docRef, {
            punkte: quizPunkteNeu,
            beantworteteRäume: beantworteteRäume
        });

        res.status(200).json({ message: "Quiz-Daten gespeichert!", punkte: quizPunkteNeu });
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Speichern der Quiz-Daten" });
    }
});

app.get("/api/data/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const docRef = doc(db, "quizErgebnisse", userId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            return res.status(404).json({ error: "Keine Daten gefunden" });
        }

        res.status(200).json(docSnap.data());
    } catch (error) {
        res.status(500).json({ error: "Fehler beim Abrufen der Daten" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));