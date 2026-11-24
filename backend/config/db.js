import mongoose from "mongoose";

const connectDb = async () => {
  // MONGODB_URL is preferred; MONGO_URI is accepted because .env.example used that name.
  const uri = process.env.MONGODB_URL || process.env.MONGO_URI;

  if (!uri) {
    console.error("Database URL is missing. Set MONGODB_URL (or MONGO_URI).");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("DB connected successfully");
  } catch (error) {
    // Do not print the connection string - it contains the DB password.
    console.error("DB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDb;
