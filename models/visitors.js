import mongoose from "mongoose";
const { Schema } = mongoose;

const VisitorSchema = new Schema({
    country: { type: String },
    city: { type: String },
    countryCode: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    query: { type: String },
    region: { type: String },
    regionName: { type: String },
    flag: { type: String },
    timeAdded: { type: String },
    currentTimeAdded: { type: String },
    device: { type: String },
    lastTimeAdded: { type: String },
    impression: { type: Number, default: 1 }
});

const Visitor = mongoose.model("Visitor", VisitorSchema);
export default Visitor;
