import { compareAll } from 'algorith';

// Configuration des poids pour chaque algorithme
const ALGORITHM_WEIGHTS = {
  levenshtein: 0.2,     // Bon pour les fautes de frappe
  jaroWinkler: 0.25,    // Excellent pour les noms propres
  hamming: 0.1,         // Moins important pour les textes de longueur variable
  trigram: 0.15,        // Bon pour les séquences
  jaccard: 0.1,         // Utile pour les ensembles de mots
  jaro: 0.1,            // Redondant avec jaroWinkler mais garde un poids léger
  dice: 0.05,           // Complémentaire
  cosine: 0.05          // Complémentaire pour l'analyse de texte
};

// Seuils de validation basés sur le score total
const SCORE_THRESHOLDS = {
  PERFECT_MATCH: 0.95,   // Match quasi-parfait
  EXCELLENT: 0.8,        // Très bon match
  GOOD: 0.65,           // Bon match
  ACCEPTABLE: 0.5       // Match acceptable
};

// Calcule un score pondéré basé sur tous les algorithmes
function calculateWeightedScore(word, target) {
  if (!word || !target) return 0;

  const results = compareAll(word.trim(), target.trim());
  let totalScore = 0;

  // Calcule le score pondéré
  for (const [algorithm, score] of Object.entries(results)) {
    const weight = ALGORITHM_WEIGHTS[algorithm] || 0;
    totalScore += score * weight;
  }

  return totalScore;
}

// Vérifie si un match est valide basé sur le score
function isValidMatch(word, target, minThreshold = SCORE_THRESHOLDS.ACCEPTABLE) {
  const score = calculateWeightedScore(word, target);
  return {
    isValid: score >= minThreshold,
    score: score,
    quality: getMatchQuality(score)
  };
}

// Détermine la qualité du match
function getMatchQuality(score) {
  if (score >= SCORE_THRESHOLDS.PERFECT_MATCH) return 'PERFECT';
  if (score >= SCORE_THRESHOLDS.EXCELLENT) return 'EXCELLENT';
  if (score >= SCORE_THRESHOLDS.GOOD) return 'GOOD';
  if (score >= SCORE_THRESHOLDS.ACCEPTABLE) return 'ACCEPTABLE';
  return 'POOR';
}

export function checkSongMatch(songName, currentSong, returnDetailedResult = false) {
  if (!currentSong || !songName) return returnDetailedResult ? { isValid: false, score: 0, quality: 'POOR' } : false;

  // Générer toutes les variantes possibles (titre, artiste, combinaisons)
  const variants = generateSongVariants(currentSong);

  if (variants.length === 0) {
    return returnDetailedResult ? { isValid: false, score: 0, quality: 'POOR' } : false;
  }

  // Trouver la meilleure correspondance
  const bestMatch = findBestMatch(songName, variants);

  if (!bestMatch.variant) {
    return returnDetailedResult ? { isValid: false, score: 0, quality: 'POOR' } : false;
  }

  const isValid = bestMatch.score >= SCORE_THRESHOLDS.ACCEPTABLE;

  if (returnDetailedResult) {
    return {
      isValid: isValid,
      score: bestMatch.score,
      quality: getMatchQuality(bestMatch.score),
      matchedVariant: bestMatch.variant,
      matchType: bestMatch.variant.type
    };
  }

  return isValid;
}

// Fonction utilitaire pour obtenir une analyse détaillée du match
export function getDetailedMatchAnalysis(songName, currentSong) {
  if (!currentSong || !songName) {
    return { error: "Paramètres manquants" };
  }

  // Générer toutes les variantes possibles
  const variants = generateSongVariants(currentSong);

  const analysis = {
    input: songName,
    target: {
      title: currentSong.name,
      artists: currentSong.artists?.map(a => a.name) || []
    },
    variantsCount: variants.length,
    results: []
  };

  let bestMatch = { score: 0, variant: null, details: null };

  // Tester chaque variante
  variants.forEach((variant, index) => {
    const rawResults = compareAll(songName.trim(), variant.text.trim());
    const weightedScore = calculateWeightedScore(songName, variant.text);
    const matchInfo = isValidMatch(songName, variant.text);

    const variantResult = {
      variantIndex: index,
      variantName: variant.name,
      variantText: variant.text,
      variantType: variant.type,
      rawScores: rawResults,
      weightedScore: weightedScore,
      isValid: matchInfo.isValid,
      quality: matchInfo.quality
    };

    // Ajouter des informations contextuelles selon le type
    if (variant.type === 'artist') {
      variantResult.artistName = variant.artistName;
    } else if (variant.type === 'artist_title' || variant.type === 'title_artist') {
      variantResult.artistName = variant.artistName;
      variantResult.titleVariant = variant.titleVariant;
    } else if (variant.type === 'title') {
      variantResult.titleVariant = variant.text;
    }

    analysis.results.push(variantResult);

    if (weightedScore > bestMatch.score) {
      bestMatch = {
        score: weightedScore,
        variant: variant,
        details: variantResult
      };
    }
  });

  analysis.bestMatch = bestMatch;
  analysis.finalDecision = bestMatch.score >= SCORE_THRESHOLDS.ACCEPTABLE;

  // Statistiques par type de variante
  analysis.stats = {
    titleOnly: analysis.results.filter(r => r.variantType === 'title').length,
    artistOnly: analysis.results.filter(r => r.variantType === 'artist').length,
    artistTitle: analysis.results.filter(r => r.variantType === 'artist_title').length,
    titleArtist: analysis.results.filter(r => r.variantType === 'title_artist').length,
    validMatches: analysis.results.filter(r => r.isValid).length
  };

  return analysis;
}

// Fonction pour ajuster dynamiquement les seuils selon le contexte
export function setCustomThresholds(thresholds) {
  Object.assign(SCORE_THRESHOLDS, thresholds);
}

// Génère toutes les variantes possibles pour le matching (titre, artiste, combinaisons)
function generateSongVariants(currentSong) {
  if (!currentSong) return [];

  const variants = [];
  const songTitle = currentSong.name || '';
  const artists = currentSong.artists || [];

  // Fonction pour nettoyer un titre (supprimer suffixes, parenthèses, etc.)
  function getCleanTitleVariants(title) {
    if (!title) return [];
    return [
      title,  // Version originale
      title.replace(/ - .*$/, ''),        // Sans suffixe " - ..."
      title.replace(/ \(.+\)$/, ''),      // Sans parenthèses
      title.replace(/ \[.+\]$/, ''),      // Sans crochets
      title.replace(/ \(feat\..*\)$/i, ''), // Sans featuring
      title.replace(/ feat\..*$/i, ''),    // Sans featuring version courte
    ].filter((v, i, arr) => v && arr.indexOf(v) === i); // Supprimer les doublons et vides
  }

  // 1. Variantes du titre seul
  const titleVariants = getCleanTitleVariants(songTitle);
  titleVariants.forEach(titleVariant => {
    variants.push({
      name: 'titre_seul',
      text: titleVariant,
      originalTitle: songTitle,
      type: 'title'
    });
  });

  // 2. Variantes des artistes seuls
  artists.forEach((artist, index) => {
    if (artist && artist.name) {
      variants.push({
        name: `artiste_seul_${index}`,
        text: artist.name,
        originalTitle: songTitle,
        artistName: artist.name,
        type: 'artist'
      });
    }
  });

  // 3. Combinaisons "Artiste Titre" et "Titre Artiste"
  artists.forEach((artist, artistIndex) => {
    if (artist && artist.name) {
      titleVariants.forEach((titleVariant, titleIndex) => {
        // "Artiste Titre"
        variants.push({
          name: `artiste_titre_${artistIndex}_${titleIndex}`,
          text: `${artist.name} ${titleVariant}`,
          originalTitle: songTitle,
          artistName: artist.name,
          titleVariant: titleVariant,
          type: 'artist_title'
        });

        // "Titre Artiste"
        variants.push({
          name: `titre_artiste_${artistIndex}_${titleIndex}`,
          text: `${titleVariant} ${artist.name}`,
          originalTitle: songTitle,
          artistName: artist.name,
          titleVariant: titleVariant,
          type: 'title_artist'
        });
      });
    }
  });

  return variants;
}

// Trouve la meilleure correspondance parmi toutes les variantes
function findBestMatch(input, variants) {
  if (!input || !variants || variants.length === 0) {
    return { score: 0, variant: null, matchInfo: null };
  }

  let bestMatch = { score: 0, variant: null, matchInfo: null };

  variants.forEach(variant => {
    const score = calculateWeightedScore(input, variant.text);
    const matchInfo = isValidMatch(input, variant.text);

    if (score > bestMatch.score) {
      bestMatch = {
        score: score,
        variant: variant,
        matchInfo: matchInfo
      };
    }
  });

  return bestMatch;
}

// Exemple d'utilisation avec le module algorith :
// const motJoueur = "adèle";         // Entrée du joueur
// const motCorrect = "Adele";        // Réponse attendue
//
// if (isClose(motJoueur, motCorrect)) {
//   console.log("🔍 Tu es très proche !");
// } else {
//   console.log("❌ Pas encore !");
// }

// Exemple d'utilisation avec analyse détaillée :
// const analysis = getDetailedMatchAnalysis("bohemian rapsody", { name: "Bohemian Rhapsody" });
// console.log("Score final:", analysis.bestMatch.score);
// console.log("Qualité:", analysis.bestMatch.details.quality);
// console.log("Décision:", analysis.finalDecision ? "ACCEPTÉ" : "REFUSÉ");
//
// Utilisation simple (compatible avec l'ancien code) :
// const isMatch = checkSongMatch("bohemian rapsody", { name: "Bohemian Rhapsody" }); // true/false
//
// Utilisation avancée avec détails :
// const detailedResult = checkSongMatch("bohemian rapsody", { name: "Bohemian Rhapsody" }, true);
// // { isValid: true, score: 0.788, quality: 'GOOD' }
//
// SYSTÈME DE SCORING :
// - 8 algorithmes de similarité avec pondération optimisée
// - Score total de 0 à 1 (1 = match parfait)
// - Seuils : PERFECT (0.95+), EXCELLENT (0.8+), GOOD (0.65+), ACCEPTABLE (0.5+)
// - Tests automatiques sur 4 variantes du titre (original, sans suffixe, sans parenthèses, sans crochets)
