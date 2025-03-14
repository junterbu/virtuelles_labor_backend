import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import fileUpload from "express-fileupload";
import {put} from "@vercel/blob";
import path from "path";
import fs from "fs";

// .env Datei laden
dotenv.config();

const corsOptions = {
    origin: "*", // Erlaube Anfragen von überall
    methods: "GET,POST,OPTIONS",
    allowedHeaders: "Content-Type"
};

const quizFragen = [
    "Gesteinsraum",
    "Rohdichte",
    "Mischer",
    "Marshall",
    "Pyknometer",
    "Hohlraumgehalt",
    "ÖNORM EN 12697-8",
    "NaBe",
    "WPK",
    "Grenzsieblinien",
    "Raumdichte"
]


// Service Account Key aus Umgebungsvariable lesen
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error("❌ Fehler: FIREBASE_SERVICE_ACCOUNT Umgebungsvariable fehlt. Setze sie in Vercel.");
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8"));
} catch (error) {
    console.error("❌ Fehler beim Dekodieren von FIREBASE_SERVICE_ACCOUNT:", error);
    process.exit(1);
}
// Firebase-Admin mit Service Account initialisieren
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin SDK erfolgreich mit Service Account initialisiert");
}

const db = getFirestore();
const app = express();
app.use(cors({
    origin: "*", // 🔥 Alle Domains erlauben
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"]
}));
app.use(express.json({ limit: "50mb" }));  // 🔥 Erlaubt größere JSON-Payloads
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(fileUpload({
    limits: { fileSize: 52428800 } // 🔥 Erlaubt bis zu 50 MB
}));

// 🔥 Zusätzliche CORS-Header setzen, um sicherzustellen, dass sie nicht entfernt werden
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length");
    res.setHeader("Content-Length", req.headers["content-length"] || "0");

    if (req.method === "OPTIONS") {
        console.log("🛑 Preflight-Anfrage erkannt. Antwort gesendet.");
        return res.status(204).end(); // OPTIONS-Request sofort beantworten
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

app.post("/api/quiz", async (req, res) => {
    try {
        const { userId, raum, auswahl } = req.body;
        const docRef = db.collection("quizErgebnisse").doc(userId);
        const docSnap = await docRef.get();

        let quizPunkteNeu = 0;
        let beantworteteFragen = [];

        if (docSnap.exists) {
            beantworteteFragen = docSnap.data().beantworteteFragen || [];
            quizPunkteNeu = docSnap.data().punkte || 0;
        }

        if (!beantworteteFragen.some(q => q.raum === raum)) {
            const quizDaten = {
                "Gesteinsraum": { frage: "Welche Aussage zur CE-Kennzeichnung von Asphaltmischgut ist korrekt?", antwort: "Sie zeigt an, dass gesetzliche Vorschriften eingehalten wurden", punkte: 10 },
                "Mischer": { frage: "Warum ist eine Typprüfung von Asphaltmischgut notwendig?", antwort: "Um die normgemäßen Anforderungen an das Mischgut zu überprüfen", punkte: 10 },
                "Marshall": { frage: "Wie wird der optimale Bindemittelgehalt eines Asphaltmischguts ermittelt?", antwort: "Durch Erstellen einer Polynomfunktion und Finden des Maximums der Raumdichten", punkte: 10 },
                "Rohdichte": { frage: "Mit welchem volumetrischen Kennwert wird die maximale Dichte eines Asphaltmischguts ohne Hohlräume beschrieben?", antwort: "Rohdichte", punkte: 10 },
                "Pyknometer": { frage: "Wofür steht die Masse m_2 im Volumetrischen Verfahren zur Ermittlung der Rohdichte nach ÖNORM EN 12697-8?", antwort: "Masse des Pyknometers mit Aufsatz, Feder und Laborprobe", punkte: 10 },
                "Hohlraumgehalt": { frage: "Ab wie viel % Hohlraumgehalt ist Verfahren D: Raumdichte durch Ausmessen der ÖNORM EN 12697-6 empfohlen?", antwort: "Ab 10%", punkte: 10 },
                "ÖNORM EN 12697-8": { frage: "Wie wird der Hohlraumgehalt eines Probekörpers nach ÖNORM EN 12697-8 ermittelt?", antwort: "Aus der Differenz von Raumdichte und Rohdichte", punkte: 10 },
                "NaBe": { frage: "Wie viele Recyclingasphalt muss ein Asphaltmischgut gemäß „Aktionsplan nachhaltige öffentlichen Beschaffung (naBe)“ mindestens enthalten?", antwort: "10M%", punkte: 10 },
                "WPK": { frage: "Wozu dient die Werkseigene Produktionskontrolle (WPK)?", antwort: "Zur Qualitätssicherung während der Produktion in Eigenüberwachung", punkte: 10 },
                "Grenzsieblinien": { frage: "Wo findet man Grenzsieblinien von Asphaltmischgütern?", antwort: "In den Produktanforderungen für Asphaltmischgut (ÖNORM B 358x-x)", punkte: 10 },
                "Raumdichte": {frage: "Welche Verfahren zur Bestimmung der Raumdichte von Asphaltprobekörpern nach ÖNORM EN 12697-6 sind für dichte Probekörper bis etwa 7% Hohlraumgehalt geeignet?", antwort: "Verfahren A: Raumdichte — trocken und Verfahren B: Raumdichte — SSD ", punkte: 10 }
            };

            let punkte = 0;
            if (quizDaten[raum]?.antwort === auswahl) {
                punkte = quizDaten[raum].punkte;
                quizPunkteNeu += punkte;
            }

            beantworteteFragen.push({
                raum: raum,
                frage: quizDaten[raum]?.frage || "Unbekannte Frage",
                gegebeneAntwort: auswahl,
                richtigeAntwort: quizDaten[raum]?.antwort || "Keine Daten",
                punkte: punkte
            });
        }

        await docRef.set({
            punkte: quizPunkteNeu,
            beantworteteFragen: beantworteteFragen
        });

        res.status(200).json({ message: "Quiz-Daten gespeichert!", punkte: quizPunkteNeu });
    } catch (error) {
        console.error("Fehler beim Speichern der Quiz-Daten:", error);
        res.status(500).json({ error: "Fehler beim Speichern der Quiz-Daten" });
    }
});


// API-Route zum Abrufen der Punkte für einen Benutzer
app.get("/api/punkte/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const docRef = db.collection("quizErgebnisse").doc(userId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ punkte: 0 });
        }

        res.status(200).json({ punkte: docSnap.data().punkte || 0 });
    } catch (error) {
        console.error("Fehler beim Abrufen der Punkte:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Punkte" });
    }
});

app.get("/api/quizfragen/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const docRef = db.collection("quizFragen").doc(userId);
        const docSnap = await docRef.get();

        // Falls der Nutzer bereits Fragen hat, zurückgeben
        if (docSnap.exists) {
            return res.status(200).json({ fragen: docSnap.data().fragen });
        } 

        // Falls noch keine Fragen gespeichert sind, 8 zufällige Fragen auswählen
        const alleFragen = [
            "Gesteinsraum",
            "Rohdichte",
            "Mischer",
            "Marshall",
            "Pyknometer",
            "Hohlraumgehalt",
            "ÖNORM EN 12697-8",
            "NaBe",
            "WPK",
            "Grenzsieblinien",
            "Raumdichte"
        ];
        const zufallsFragen = alleFragen.sort(() => Math.random() - 0.5).slice(0, 8); // Wähle 8 zufällige Fragen

        await docRef.set({ fragen: zufallsFragen });
        return res.status(200).json({ fragen: zufallsFragen });

    } catch (error) {
        console.error("Fehler beim Abrufen der Fragen:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Fragen" });
    }
});

app.get("/api/beantworteteFragen/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const docRef = db.collection("quizErgebnisse").doc(userId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(200).json({ fragen: [] });
        }

        res.status(200).json({ fragen: docSnap.data().beantworteteRäume || [] });
    } catch (error) {
        console.error("Fehler beim Abrufen der beantworteten Fragen:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der beantworteten Fragen" });
    }
});

app.get("/api/quizErgebnisse/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const docRef = db.collection("quizErgebnisse").doc(userId);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(404).json({ ergebnisse: [] });
        }

        const gespeicherteDaten = docSnap.data();
        const beantworteteFragen = gespeicherteDaten.beantworteteFragen || [];

        res.status(200).json({
            ergebnisse: beantworteteFragen,
            gesamtPunkte: gespeicherteDaten.punkte || 0
        });
    } catch (error) {
        console.error("Fehler beim Abrufen der Quiz-Ergebnisse:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Quiz-Ergebnisse" });
    }
});

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// 🔥 Route zum Hochladen von Datei-Chunks
app.post("/api/uploadChunk", async (req, res) => {
    try {
        const { userId, fileName, chunkIndex, totalChunks } = req.body;
        const chunk = req.files.chunk;

        if (!chunk) {
            return res.status(400).json({ error: "Kein Datei-Chunk erhalten" });
        }

        const tempFilePath = path.join(UPLOAD_DIR, `${fileName}.part${chunkIndex}`);
        await chunk.mv(tempFilePath);
        console.log(`📂 Chunk ${chunkIndex + 1}/${totalChunks} gespeichert`);

        res.status(200).json({ message: `Chunk ${chunkIndex + 1}/${totalChunks} gespeichert` });

    } catch (error) {
        console.error("❌ Fehler beim Speichern eines Chunks:", error);
        res.status(500).json({ error: "Fehler beim Speichern eines Chunks" });
    }
});

// 🔥 Route zum Zusammenfügen der Datei
app.post("/api/mergeChunks", async (req, res) => {
    try {
        const { userId, fileName, totalChunks } = req.body;
        const finalFilePath = path.join(UPLOAD_DIR, fileName);
        const writeStream = fs.createWriteStream(finalFilePath);

        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(UPLOAD_DIR, `${fileName}.part${i}`);
            if (!fs.existsSync(chunkPath)) {
                return res.status(400).json({ error: `Chunk ${i + 1} fehlt` });
            }
            const chunkData = fs.readFileSync(chunkPath);
            writeStream.write(chunkData);
            fs.unlinkSync(chunkPath); // 🔥 Löscht Chunk nach dem Zusammenfügen
        }
        writeStream.end();

        // 🔥 Datei in Vercel Blob hochladen
        const fileData = fs.readFileSync(finalFilePath);
        const blob = await put(`laborberichte/${fileName}`, fileData, { access: "public" });

        fs.unlinkSync(finalFilePath); // 🔥 Löscht die temporäre Datei nach dem Hochladen

        console.log(`✅ PDF erfolgreich gespeichert: ${blob.url}`);
        res.status(200).json({ message: "PDF erfolgreich gespeichert", url: blob.url });

    } catch (error) {
        console.error("❌ Fehler beim Zusammenfügen der Datei:", error);
        res.status(500).json({ error: "Fehler beim Zusammenfügen der Datei" });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));