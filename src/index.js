import { Mongoose } from "mongoose";
import { DB_NAME } from "./constants.js";
import dotenv from "dotenv"
import express from "express";
import connectDB from "./db/indexDB.js";
import { app } from "./app.js";

dotenv.config({
    path: './env'
})




connectDB()
.then(() => {
    app.listen(process.env.PORT || 9000, () => {
        console.log(`app is running on port ${process.env.PORT}`)
    })
})
.catch((err) => {
    console.log(`error in the mongodb express connection`, err)
})
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

