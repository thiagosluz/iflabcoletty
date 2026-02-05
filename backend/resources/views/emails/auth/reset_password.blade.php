<!DOCTYPE html>
<html>

<head>
    <title>Redefinição de Senha</title>
</head>

<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
    <div
        style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333;">Redefinição de Senha</h2>
        <p>Você está recebendo este e-mail porque recebemos uma solicitação de redefinição de senha para sua conta.</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="{{ $url }}"
                style="background-color: #007bff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Redefinir
                Senha</a>
        </div>
        <p>Este link de redefinição de senha expirará em 60 minutos.</p>
        <p>Se você não solicitou uma redefinição de senha, nenhuma ação adicional é necessária.</p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="font-size: 12px; color: #777;">Se estiver com problemas para clicar no botão "Redefinir Senha", copie
            e cole o URL abaixo no seu navegador da web:</p>
        <p style="font-size: 12px; color: #007bff; word-break: break-all;">{{ $url }}</p>
    </div>
</body>

</html>