import { Mongoose } from "mongoose";
import { DB_NAME } from "./constants.js";
import dotenv from "dotenv"
import express from "express";
import connectDB from "./db/indexDB.js";

dotenv.config({
    path: './env'
})

const app = express();


connectDB();
/*
;(async () => {
    try {
    Mongoose.connect(`${MONGODB_URL}/${DB_NAME}`)
    app.on("error", (error) => {
        console.log("ERROR", error)
        throw error
    })
    app.listen(process.env.PORT, () => {
        console.log(`server is running on port ${PORT}`)
    })

    } catch(error) {
        console.log("error mila hai", error)
        throw error
    }
})()
*/

