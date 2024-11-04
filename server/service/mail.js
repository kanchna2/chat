import nodemailer from 'nodemailer';


// Nodemailer transporter setup with Gmail SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'navinmanohar78086@gmail.com', 
        pass: 'aawm ghga qnxx minr', 
    },
});

/**
 * Send OTP to the user's email
 * @param {string} email - Recipient's email address
 * @param {string} otp - OTP code to be sent
 */
const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: 'your-email@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It is valid for 10 minutes.`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('OTP email sent successfully');
    } catch (error) {
        console.error('Error sending OTP email:', error);
        throw new Error('Failed to send OTP email');
    }
};

export { sendOTPEmail };
