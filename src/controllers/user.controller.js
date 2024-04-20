import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from '../utils/apiError.js';
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import mongoose from "mongoose";

const registerUser = asyncHandler( async (req, res) => {
    const {fullName, email, username, password} = req.body;
    console.log("email: ", email);

    if(
        [fullName, email, password, username].some((field) =>
     field?.trim == "")
    ) {
        throw new apiError(400, "all fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(existedUser) {
        throw new apiError(409, "user with email or username already exist")
    }
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath) {
        throw new apiError(400, "avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar) {
        throw new apiError(400, "avatar file is required")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        " -password -refreshToken"
    )

    if(!createdUser) {
        throw new apiError(500, "somethig went wrong while registering the user")
    }

    return res.status(201).json(
        new apiResponse(200, createdUser, "user registered sccessfully")
    )
    
})

export {
    registerUser,
}