import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// .env Datei laden
dotenv.config();

const corsOptions = {
    origin: "*", // Erlaube Anfragen von überall
    methods: "GET,POST,OPTIONS",
    allowedHeaders: "Content-Type"
};

// Service Account Key laden
const serviceAccountPath = path.resolve("./serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Fehler: serviceAccountKey.json fehlt. Stelle sicher, dass die Datei existiert.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

// Firebase-Admin mit Service Account initialisieren
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin SDK erfolgreich mit Service Account initialisiert");
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

// Route für das Abrufen der Daten mit erweitertem Logging
app.get("/api/data/:userId", async (req, res) => {
    try {
        res.set("Access-Control-Allow-Origin", "*");
        const userId = req.params.userId;
        console.log(`📥 Anfrage erhalten für userId: ${userId}`);

        const docRef = db.collection("quizErgebnisse").doc(userId);
        console.log("🔍 Verbindung zu Firestore...", docRef.path);

        const fetchData = new Promise(async (resolve, reject) => {
            try {
                const docSnap = await docRef.get();
                console.log("📄 Firestore-Dokument gefunden:", docSnap.exists);

                if (!docSnap.exists) {
                    console.warn("⚠️ Keine Daten für diesen Benutzer gefunden");
                    return resolve({ error: "Keine Daten gefunden" });
                }
                resolve(docSnap.data());
            } catch (error) {
                console.error("❌ Fehler bei Firestore-Abfrage:", error);
                reject(error);
            }
        });

        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Firestore Timeout")), 5000)
        );

        const result = await Promise.race([fetchData, timeout]);
        res.status(200).json(result);
    } catch (error) {
        console.error("🔥 Fehler beim Abrufen der Daten:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Daten" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));
