import configuration from "../configuration/index.js";

export const generateEmailTemplate = ({ title, username, body, button }) => {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:Arial, sans-serif;">

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#ffffff;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; margin:0 auto;">

                    <!-- Header -->


                    <!-- Main Content -->
                    <tr>
                        <td
                            style="background-color:#3f3f3f; border-radius:16px; padding:40px; text-align:left; color:#ffffff;">
                            <h3 style="font-size:18px; font-weight:700; margin:0 0 20px; color: #ffffff;">${title}</h3>
                            <p style="font-size:14px; line-height:1.8; color:#bbbbbb; margin:0 0 30px;">
                                Hello ${username},<br>${body}
                            </p>
                            ${button}
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" style="padding:40px 20px; color:#777777; font-size:12px; line-height:1.6;">
                            <p>If you have any questions, feel free to
                                <a href="mailto:support@yourbrand.com"
                                    style="color:#ff4b2b; font-weight:600; text-decoration:none;">contact us</a>.
                            </p>
                            <p>You received this email because you signed up at ${configuration.ProjectTitle}.<br></p>
                            <p style="margin-top:15px;">&copy; 2025 ${configuration.ProjectTitle}. All Rights Reserved.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>

</body>
</html>
    `;
};
