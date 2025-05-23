import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
    path: './env'
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 5000, () => console.log('Listening on port ' + process.env.PORT || 5000));
})
.catch((err) => {
    console.log("MongoDB Connection error", err);
});