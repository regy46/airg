import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  // API Route for Gemini
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing in environment variables.");
        return res.status(500).json({ error: "API Key belum dikonfigurasi di server Vercel." });
      }

      console.log("Attempting to call Gemini API...");
      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...history, { role: 'user', parts: [{ text: message }] }],
        config: {
          systemInstruction: `Anda adalah AI R.G, asisten pendidikan super cerdas yang dirancang khusus untuk membantu murid-murid di kelas. 
          Karakter Anda:
          1. Sangat cerdas, berwawasan luas, namun ramah dan sabar.
          2. Mampu menjelaskan konsep rumit (Sains, Matematika, Sejarah, dll.) dengan bahasa yang mudah dimengerti siswa.
          3. Gunakan gaya bahasa "Bahasa Gaul Jakarta" yang sopan namun asik (seperti menggunakan kata "gue", "lo", "banget", "nih", "deh", "kok", dll.) agar terasa seperti teman belajar yang keren.
          4. Selalu mendorong siswa untuk berpikir kritis, bukan sekadar memberi jawaban langsung.
          5. Sangat ahli dalam Bahasa Indonesia dan memahami konteks budaya lokal.
          6. Jika ada typo, Anda tetap mengerti maksud siswa dan memperbaikinya secara halus dalam penjelasan Anda.
          7. Gunakan analogi yang menarik untuk menjelaskan materi pelajaran.`,
        }
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Server Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  return app;
}

// Start the server immediately
const appPromise = startServer();
export default appPromise;
