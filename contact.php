<?php
// ============================================
// WEBOOST STUDIO — FORMULAIRE DE CONTACT
// Envoi d'email à contact@weboost-studio.fr
// ============================================

// Protection CSRF & anti-spam
header('Content-Type: application/json; charset=utf-8');

// Autoriser uniquement les requêtes POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Méthode non autorisée.']);
    exit;
}

// Anti-spam : vérifier le honeypot (champ caché)
if (!empty($_POST['website'])) {
    // Un bot a rempli le champ caché
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Requête rejetée.']);
    exit;
}

// Récupérer et nettoyer les données
$name    = trim(htmlspecialchars($_POST['name'] ?? '', ENT_QUOTES, 'UTF-8'));
$email   = trim(filter_var($_POST['email'] ?? '', FILTER_SANITIZE_EMAIL));
$phone   = trim(htmlspecialchars($_POST['phone'] ?? '', ENT_QUOTES, 'UTF-8'));
$project = trim(htmlspecialchars($_POST['project'] ?? '', ENT_QUOTES, 'UTF-8'));
$message = trim(htmlspecialchars($_POST['message'] ?? '', ENT_QUOTES, 'UTF-8'));

// Validation
$errors = [];

if (empty($name) || strlen($name) < 2) {
    $errors[] = 'Le nom est requis (minimum 2 caractères).';
}

if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = 'Une adresse email valide est requise.';
}

if (empty($message) || strlen($message) < 10) {
    $errors[] = 'Le message est requis (minimum 10 caractères).';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => implode(' ', $errors)]);
    exit;
}

// Libellés des types de projets
$projectLabels = [
    'starter'     => 'Site Starter (3 pages — 600€)',
    'business'    => 'Site Business (5 pages — 1 300€)',
    'premium'     => 'Site Premium (sur-mesure)',
    'seo'         => 'Référencement SEO',
    'social'      => 'Social Management',
    'maintenance' => 'Maintenance',
    'autre'       => 'Autre demande',
];

$projectLabel = $projectLabels[$project] ?? ($project ?: 'Non spécifié');

// ============================================
// CONSTRUCTION DE L'EMAIL
// ============================================

$to = 'contact@weboost-studio.fr';
$subject = "Nouveau contact Weboost Studio — $name";

// Corps de l'email en HTML
$body = "
<!DOCTYPE html>
<html>
<head><meta charset='UTF-8'></head>
<body style='font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px;'>
  <div style='max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);'>
    
    <div style='background: #4f46e5; padding: 24px 32px;'>
      <h1 style='color: #ffffff; font-size: 20px; margin: 0;'>Nouvelle demande de contact</h1>
      <p style='color: rgba(255,255,255,0.8); font-size: 14px; margin: 8px 0 0;'>Via le formulaire weboost-studio.fr</p>
    </div>
    
    <div style='padding: 32px;'>
      <table style='width: 100%; border-collapse: collapse;'>
        <tr>
          <td style='padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; width: 140px; vertical-align: top;'>Nom</td>
          <td style='padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px; color: #333;'><strong>$name</strong></td>
        </tr>
        <tr>
          <td style='padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; vertical-align: top;'>Email</td>
          <td style='padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px; color: #333;'><a href='mailto:$email' style='color: #4f46e5;'>$email</a></td>
        </tr>
        <tr>
          <td style='padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; vertical-align: top;'>Téléphone</td>
          <td style='padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px; color: #333;'>" . ($phone ?: '<em style=\"color:#999\">Non renseigné</em>') . "</td>
        </tr>
        <tr>
          <td style='padding: 12px 0; border-bottom: 1px solid #eee; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; vertical-align: top;'>Projet</td>
          <td style='padding: 12px 0; border-bottom: 1px solid #eee; font-size: 15px; color: #333;'>$projectLabel</td>
        </tr>
        <tr>
          <td style='padding: 12px 0; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; vertical-align: top;'>Message</td>
          <td style='padding: 12px 0; font-size: 15px; color: #333; line-height: 1.6;'>" . nl2br($message) . "</td>
        </tr>
      </table>
    </div>
    
    <div style='background: #f9f9f9; padding: 16px 32px; border-top: 1px solid #eee;'>
      <p style='font-size: 12px; color: #999; margin: 0;'>
        Envoyé le " . date('d/m/Y à H:i') . " depuis weboost-studio.fr
        — IP : " . ($_SERVER['REMOTE_ADDR'] ?? 'inconnue') . "
      </p>
    </div>
    
  </div>
</body>
</html>
";

// Headers de l'email
$headers  = "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";
$headers .= "From: Weboost Studio <noreply@weboost-studio.fr>\r\n";
$headers .= "Reply-To: $name <$email>\r\n";
$headers .= "X-Mailer: PHP/" . phpversion();

// ============================================
// ENVOI
// ============================================

$sent = mail($to, $subject, $body, $headers);

if ($sent) {
    echo json_encode(['success' => true, 'message' => 'Merci ! Votre message a bien été envoyé. Je vous réponds sous 24h.']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erreur lors de l\'envoi. Contactez-moi directement à contact@weboost-studio.fr']);
}