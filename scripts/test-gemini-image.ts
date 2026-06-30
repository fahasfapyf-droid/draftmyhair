import { GoogleGenAI } from "@google/genai";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";

dotenv.config({
  path: path.join(process.cwd(), ".env.local"),
});

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY not found.");
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const inputPath = path.join(process.cwd(), "public", "test.jpg");

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Image not found:\n${inputPath}`);
  }

  const image = fs.readFileSync(inputPath);

  const base64 = image.toString("base64");

  const interaction = await ai.interactions.create({
    model: "gemini-3.1-flash-image",

    input: [
      {
        type: "text" as const,
        text: "Replace ONLY the hairstyle with a realistic shoulder-length layered haircut. Preserve the face, identity, skin, eyes, ears, lighting and background exactly.",
      },
      {
        type: "image" as const,
        mime_type: "image/jpeg",
        data: base64,
      },
    ],
  });

  if (!interaction.output_image?.data) {
    console.dir(interaction, { depth: null });
    throw new Error("Gemini returned no image.");
  }

  const outputBuffer = Buffer.from(
    interaction.output_image.data,
    "base64"
  );

  const outputPath = path.join(
    process.cwd(),
    "public",
    "generated-test.png"
  );

  fs.writeFileSync(outputPath, outputBuffer);

  console.log("");
  console.log("✅ SUCCESS");
  console.log(outputPath);
}

main().catch((err) => {
  console.error(err);
});