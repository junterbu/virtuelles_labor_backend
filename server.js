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

const quizFragen = {
    "Gesteinsraum": { frage: "Welche Aussage zur CE-Kennzeichnung von Asphaltmischgut ist korrekt?", optionen: ["Sie garantiert eine hohe Qualität des Produkts", "Sie zeigt an, dass gesetzliche Vorschriften eingehalten wurden", "Sie ist nur für importierte Baustoffe erforderlich", "Sie wird nur auf Wunsch des Herstellers vergeben"], antwort: "Sie zeigt an, dass gesetzliche Vorschriften eingehalten wurden", punkte: 10 },
    "Rohdichte": { frage: "Mit welchem volumetrischen Kennwert wird die maximale Dichte eines Asphaltmischguts ohne Hohlräume beschrieben?", optionen: ["Raumdichte", "Rohdichte", "Schüttdichte", "lose Dichte"], antwort: "Rohdichte", punkte: 10 },
    "Mischer": { frage: "Warum ist eine Typprüfung von Asphaltmischgut notwendig?", optionen: ["Um den richtigen Mischguttyp für eine Baustelle zu ermitteln", "Um die normgemäßen Anforderungen an das Mischgut zu überprüfen", "Um die optimale Temperatur für das Mischen festzulegen", "Um den Recyclinganteil im Asphalt zu bestimmen"], antwort: "Um die normgemäßen Anforderungen an das Mischgut zu überprüfen", punkte: 10 },
    "Marshall": { frage: "Wie wird der optimale Bindemittelgehalt eines Asphaltmischguts ermittelt?", optionen: ["Durch eine rechnerische Ableitung der Sieblinie", "Durch Erhitzen des Mischguts auf eine festgelegte Temperatur", "Durch Erstellen einer Polynomfunktion und Finden des Maximums der Raumdichten", "Durch Zugabe von Bindemittel in 1%-Schritten und Sichtprüfung"], antwort: "Durch Erstellen einer Polynomfunktion und Finden des Maximums der Raumdichten", punkte: 10 },
    "Pyknometer": { frage: "Wofür steht die Masse m_2 im Volumetrischen Verfahren zur Ermittlung der Rohdichte nach ÖNORM EN 12697-8?", optionen: ["Masse des Pyknometers mit Aufsatz, Feder und Laborprobe", "Masse des Pyknometers mit Aufsatz, Feder, Laborprobe und Wasser", "Masse des Pyknometers mit Aufsatz und Feder", "Volumen des Pyknometers bei Füllung bis zur Messmarke"], antwort: "Masse des Pyknometers mit Aufsatz, Feder und Laborprobe", punkte: 10 },
    "Hohlraumgehalt": { frage: "Ab wie viel % Hohlraumgehalt ist Verfahren D: Raumdichte durch Ausmessen der ÖNORM EN 12697-6 empfohlen?", optionen: ["Ab 1%", "Ab 10%", "Ab 7%", "Ab 23%"], antwort: "Ab 10%", punkte: 10 },
    "ÖNORM EN 12697-8": { frage: "Wie wird der Hohlraumgehalt eines Probekörpers nach ÖNORM EN 12697-8 ermittelt?", optionen: ["Aus der Differenz von Raumdichte und Rohdichte", "Aus der Raumdichte und den Abmessungen", "Aus der Rohdichte und den Abmessungen", "Aus den Abmessungen und dem Volumen"], antwort: "Aus der Differenz von Raumdichte und Rohdichte", punkte: 10 },
    "NaBe": { frage: "Wie viele Recyclingasphalt muss ein Asphaltmischgut gemäß „Aktionsplan nachhaltige öffentlichen Beschaffung (naBe)“ mindestens enthalten?", optionen: ["0M%", "10M%", "20M%", "30M%"], antwort: "10M%", punkte: 10 },
    "WPK": { frage: "Wozu dient die Werkseigene Produktionskontrolle (WPK)?", optionen: ["Zur Qualitätssicherung während der Produktion in Eigenüberwachung", "Zur Sicherstellung eines wirtschaftlichen Produktionsablaufs", "Zur Maximierung des Produktionsvolumens", "Zur Qualitätssicherung nach dem Einbau"], antwort: "Zur Qualitätssicherung während der Produktion in Eigenüberwachung", punkte: 10 },
    "Grenzsieblinien": {
        frage: "Wo findet man Grenzsieblinien von Asphaltmischgütern?",
        optionen: ["In den Produktanforderungen für Asphaltmischgut (ÖNORM B 358x-x)", "In den Produktanforderungen für Gesteinskörnungen (ÖNORM B 3130)", "In den Richtlinien für Anforderungen an Asphaltschichten (RVS 08.16.01)", "In der Richtlinie für die Ausführung (RVS 08.07.03)"],
        antwort: "In den Produktanforderungen für Asphaltmischgut (ÖNORM B 358x-x)",
        punkte: 10
    },
    "Raumdichte": {
        frage: "Welche Verfahren zur Bestimmung der Raumdichte von Asphaltprobekörpern nach ÖNORM EN 12697-6 sind für dichte Probekörper bis etwa 7% Hohlraumgehalt geeignet?",
        optionen: ["Verfahren A: Raumdichte — trocken und Verfahren B: Raumdichte — SSD ", "Nur Verfahren B: Raumdichte — SSD ", "Nur Verfahren A: Raumdichte — trocken", "Verfahren C: Raumdichte — umhüllter Probekörper und Verfahren D: Raumdichte durch Ausmessen"],
        antwort: "Verfahren A: Raumdichte — trocken und Verfahren B: Raumdichte — SSD ",
        punkte: 10
    }
};

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
                "Rohdichte": {antwort: "Rohdichte", punkte: 10},
                "Mischer": { antwort: "Um die normgemäßen Anforderungen an das Mischgut zu überprüfen", punkte: 10 },
                "Marshall": { antwort: "Durch Erstellen einer Polynomfunktion und Finden des Maximums der Raumdichten", punkte: 10 },
                "Pyknometer": { antwort: "Masse des Pyknometers mit Aufsatz, Feder und Laborprobe", punkte: 10 },
                "Hohlraumgehalt": { antwort: "Ab 10%", punkte: 10 },
                "ÖNORM EN 12697-8": {antwort: "Aus der Differenz von Raumdichte und Rohdichte", punkte: 10},
                "NaBe": {antwort: "10M%", punkte: 10},
                "WPK": {antwort: "Zur Qualitätssicherung während der Produktion in Eigenüberwachung", punkte: 10},
                "Grenzsieblinie": {antwort: "In den Produktanforderungen für Asphaltmischgut (ÖNORM B 358x-x)", punkte:10},
                "Raumdichte": {antwort: "Verfahren A: Raumdichte — trocken und Verfahren B: Raumdichte — SSD ", punkte:10}
            };

            if (quizFragen[raum]?.antwort === auswahl) {
                quizPunkteNeu += quizFragen[raum].punkte;
            }
            beantworteteRäume.push(raum);
        }

        await docRef.set({ punkte: quizPunkteNeu, beantworteteRäume });

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

// Route: Fragen für einen Studenten abrufen oder generieren
app.get("/api/quizfragen/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;
        const docRef = db.collection("quizFragen").doc(userId);
        const docSnap = await docRef.get();

        // Falls Fragen bereits existieren, zurückgeben
        if (docSnap.exists) {
            return res.status(200).json({ fragen: docSnap.data().fragen });
        }

        // Falls noch keine Fragen gespeichert sind, 5 zufällige Fragen auswählen
        const alleFragen = Object.keys(quizFragen);
        const zufallsFragen = alleFragen.sort(() => 0.5 - Math.random()).slice(5); // 5 zufällige Fragen

        await docRef.set({ fragen: zufallsFragen });
        return res.status(200).json({ fragen: zufallsFragen });

    } catch (error) {
        console.error("Fehler beim Abrufen der Fragen:", error);
        res.status(500).json({ error: "Fehler beim Abrufen der Fragen" });
    }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf Port ${PORT}`));