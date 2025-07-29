// Fonction pour calculer la distance de Levenshtein
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // Suppression
        matrix[i][j - 1] + 1,      // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }

  return matrix[a.length][b.length];
}

// Vérifie si un mot est proche d’un autre (tolérance paramétrable)
function isClose(word, target, tolerance = 2) {
  const distance = levenshtein(word.trim(), target.trim());
  return distance <= tolerance;
}

// // Exemple d’utilisation :
// const motJoueur = "adèle";         // Entrée du joueur
// const motCorrect = "Adele";        // Réponse attendue

// if (isClose(motJoueur, motCorrect)) {
//   console.log("🔍 Tu es très proche !");
// } else {
//   console.log("❌ Pas encore !");
// }
