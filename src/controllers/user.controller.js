import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { isPasswordCorrect, generateAccessToken, generateReferenceToken } from "../models/user.model.js";


const generateAccessAndReferenceToken = async (useId) => {
    try {
        const user = User.findById(useId)
        const accessToken = user.generateAccessToken()
        const referenceToken = user.generateReferenceToken()

        user.referenceToken = referenceToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, referenceToken };
    } catch(err) {
        throw new ApiError(500, "Invalid access token")
    }
}

const registerUser = asyncHandler (async (req, res) => {
    const { username, email, fullname, password } = req.body;

    if ([fullname, email, username, password].some(field => field?.trim() === "")) {
        throw new ApiError(400, "Please fill in all fields");
    }

    const existedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if (existedUser) {
        throw new ApiError(409, "User already exists");
    }
    // console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please upload an avatar");
    }


    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(400, "Avatar is required !");
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering a user.");   
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully.")
    )
})

const loginUser = asyncHandler (async (req, res) => {
    const { username, email, password } = req.body

    if (!username || !email) {
        throw new ApiError(400, "Provide at least one username or email");
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(401, "User does not exists");
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, referenceToken } = await generateAccessAndReferenceToken(user._id)

    const loginUser = await User.findById(user._id).select("-password -referenceToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken" , accessToken, options)
    .cookie("referenceToken", referenceToken, options)
    .json(
        new ApiResponse(200, {
            user: loginUser, accessToken, referenceToken
        }),
        "User login successfully....!"
    )
})

const logOutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, {
            $set: {
                referenceToken: undefined,
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
    .clearCookie("referenceToken", options)
    .json(
        new ApiResponse(200, {}, "User logged out successfully.")
    )
})

export { registerUser, loginUser, logOutUser }