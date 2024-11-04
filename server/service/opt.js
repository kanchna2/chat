import { sendOTPEmail } from "./mail.js";

const otpStorage = {}; // Temporary storage for OTPs

// Generate and send OTP to user
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
export const requestOTP = async (email) => {
    const otp = generateOTP();
    otpStorage[email] = { otp, expires: Date.now() + 10 * 60 * 1000 }; // Valid for 10 minutes
    await sendOTPEmail(email, otp);
    console.log(`OTP for ${email} is ${otp}`);
    return { success: true, message: 'OTP sent to email' };
};

// Verify OTP
export const verifyOTP = (email, enteredOTP) => {
    const storedData = otpStorage[email];

    if (!storedData) {
        return { success: false, message: 'OTP not found or expired' };
    }

    if (storedData.expires < Date.now()) {
        delete otpStorage[email]; // Delete expired OTP
        return { success: false, message: 'OTP expired' };
    }

    if (storedData.otp === enteredOTP) {
        delete otpStorage[email]; // Remove OTP after successful verification
        return { success: true, message: 'OTP verified successfully' };
    }

    return { success: false, message: 'Invalid OTP' };
};
