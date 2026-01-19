import mongoose from "mongoose";
import "dotenv/config";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("MongoDB Connected Successfully");
    }
    catch (e) {
        console.error("Error in connecting MongoDB: ", e);
        process.exit(1);
    }
};

export default connectDB;