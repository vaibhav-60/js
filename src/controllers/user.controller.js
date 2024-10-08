import { asyncHandler } from "../utils/asyncHandler.js";
import {apiError} from '../utils/apiError.js';
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async(userId) => {

    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        console.log("tokens " + refreshToken, accessToken);

        return {accessToken, refreshToken}

    } catch (error) {
        if(!userId) {
            throw new apiError(500, "something went wrong while generating access token and refresh token")
        }
    }

}

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

const loginUser = asyncHandler(async (req, res) => {
    const {email, username, password} = req.body

    if(!(email || username)) {
    throw new apiError(400, "username or email required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user) {
        throw new apiError(404, "user does not exist nikal lawde")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid) {
        throw new apiError(401, "invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
    console.log("tokens " + accessToken, refreshToken);
    

    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)

    .json(
        new apiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
                
            },
            "user loggedIn successfully"
        )
    )
})
    

const logoutUser = asyncHandler( async (req,res) => {
    User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
        
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json( new apiResponse(200, {}, "user logged out"))
})

const refreshAccessToken = asyncHandler( async (req, res) => {

        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

        if(!incomingRefreshToken) {
            throw new apiError(401, "unauthorized request")
        }

        try {
            const decodedToken = jwt.verify(
                incomingRefreshToken,
                process.env.ACCESS_TOKEN_SECRET
            )
    
            const user = await User.findById(decodedToken?._id)
    
            if(!user) {
                throw new apiError(401, "invalid refresh token")
            }
    
            if (incomingRefreshToken !== user?.refreshToken) {
                throw new apiError(401, "Refresh token is invalid or expired")
            }
    
            const options = {
                httpOnly: true,
                secure: true 
            }
    
            const {accessToken, newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
            return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new apiResponse(
                    200,
                    {accessToken, newRefreshToken},
                    "accesstoken refreshed successfully"
                )
            )
        } catch (error) {
            throw new apiError(401, error?.message || "Invalid refresh token")
            
        }


})

const changeCurrentPassword = asyncHandler( async (req, res) => {
    const {oldPassword, newPassword} = req.body

    const user = User.findById(req.user?.id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect) {
        throw new apiError(400, "Invalid old password")
    }

    user.password = newPassword
    user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new apiResponse (
        200, {}, "password updated successfully"
    ))

})

const getCurrentUser = asyncHandler( async(req, res) => {
    return res
    .status(200)
    .json(new apiResponse(200, req.user, "Current user fetched successfully"))
})

const updateAccountDetails = asyncHandler( async (req, res) => {
    const {fullName, email} = req.body
    if(!fullName || !email) {
        throw new apiError(401, "all fields are required")
    }

    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName,
                email
            },
            
        },
        {
            new: true
        }
        
    )

    return res
    .status(200)
    .json(
        apiResponse(200, user, "username and password is updated")

    )
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) {
        throw new apiError(401, "avatar file is not found")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url) {
        throw new apiError(400, "error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200, user, "avatar updated successfully")
    )

})

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath) {
        throw new apiError(401, "avatar file is not found")
    }

    const coverImage = await uploadOnCloudinary(avatarLocalPath)

    if(!coverImage.url) {
        throw new apiError(400, "error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200, user, "coverimage updated successfully")
    )

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params
    
    if(!username?.trim()) {
        throw new apiError(400, "username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])
    if(!channel?.length) {
        throw new apiError(404, "channel does not exist")
    }

    return res
    .status(200)
    .json(
        new apiResponse(200, channel[0], "user channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        userName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
    
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                    
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            user[0].watchHistory,
            "watched history fetched successffully"
            
        )
    )

})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserCoverImage,
    updateUserAvatar,
    getUserChannelProfile,
    getWatchHistory
}