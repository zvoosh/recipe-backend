require("dotenv").config();
const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const admin = require("./firebase");
const bcrypt = require("bcrypt");
const ImageKit = require("imagekit");
const cors = require("cors");

const db = admin.firestore();
const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT;
app.use(express.json());

app.use(cors());
console.log("Public Key:", process.env.IMAGEKITPUBLIC);
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKITPUBLIC,
  privateKey: process.env.IMAGEKITPRIVATE,
  urlEndpoint: process.env.URLENDPOINT,
});

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

app.get("/api/test", (req, res) => {
  res.send("API is working");
});

app.post("/api/user", async (req, res) => {
  const uid = uuidv4();
  const { fullName, username, loginSecret } = req.body;

  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(loginSecret, saltRounds);

    await db.collection("user").doc(uid).set({
      uid,
      fullname: fullName,
      username,
      password: hashedPassword,
    });

    res.status(201).json({ message: "User created", uid });
  } catch (err) {
    console.error("User creation error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, loginSecret } = req.body;

  try {
    const snapshot = await db
      .collection("user")
      .where("username", "==", username)
      .get();
    if (snapshot.empty)
      return res.status(401).json({ error: "Invalid credentials" });

    const userData = snapshot.docs[0].data();

    const isMatch = await bcrypt.compare(loginSecret, userData.password);

    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    res.status(200).json({ message: "Login successful", userData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/recipe", upload.single("image"), async (req, res) => {
  const id = uuidv4();
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required" });
  }

  const {
    title,
    time,
    servings,
    privacy,
    calories,
    protein,
    carb,
    contains,
    userId,
    ingredients,
    instructions,
  } = req.body;
  const parsedIngredients = JSON.parse(ingredients);
  const parsedInstructions = JSON.parse(instructions);

  console.log("parsed", parsedIngredients, parsedInstructions)

  try {
    const uploadResponse = await imagekit.upload({
      file: req.file.buffer,
      fileName: `${id}_${req.file.originalname}`,
      folder: "/recipes",
    });

    await db.collection("recipes").doc(id).set({
      id,
      title,
      time,
      servings,
      privacy,
      calories,
      protein,
      carb,
      userId,
      contains,
      ingredients: parsedIngredients,
      instructions: parsedInstructions,
      imageName: uploadResponse.name,
      imageUrl: uploadResponse.url,
    });

    res.status(201).json({ message: "Recipe created", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/recipe", async (req, res) => {
  try {
    const snapshot = await db.collection("recipes").get();
    const products = snapshot.docs.map((doc) => doc.data());
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/recipe/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const doc = await db.collection("recipes").doc(id).get();
    if (!doc.exists)
      return res.status(404).json({ error: "Recipe not found" });

    res.status(200).json(doc.data());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/recipe/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await db.collection("recipes").doc(id).delete();
    res.status(200).json({ message: "Recipe deleted", id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
