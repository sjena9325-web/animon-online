const MOVE_DATABASE = {
  // =====================
  // PRIORITY MOVES
  // =====================
  "quick-attack": {
    category: "priority",
    priorityBonus: 15,
    effectText: "Priority move. Attacks earlier."
  },

  "extreme-speed": {
    category: "priority",
    priorityBonus: 30,
    effectText: "Very high priority move."
  },

  "aqua-jet": {
    category: "priority",
    priorityBonus: 15,
    effectText: "Priority Water attack."
  },

  "mach-punch": {
    category: "priority",
    priorityBonus: 15,
    effectText: "Priority Fighting attack."
  },

  "bullet-punch": {
    category: "priority",
    priorityBonus: 15,
    effectText: "Priority Steel attack."
  },

  "shadow-sneak": {
    category: "priority",
    priorityBonus: 15,
    effectText: "Priority Ghost attack."
  },

  "ice-shard": {
    category: "priority",
    priorityBonus: 15,
    effectText: "Priority Ice attack."
  },

  "sucker-punch": {
    category: "priority",
    priorityBonus: 20,
    effectText: "High-priority surprise attack."
  },

  "fake-out": {
    category: "priority",
    priorityBonus: 25,
    effectText: "Very fast opening attack."
  },

  // =====================
  // POISON MOVES
  // =====================
  "poison-sting": {
    statusEffect: "poison",
    statusChance: 30,
    effectText: "30% chance to poison."
  },

  "sludge": {
    statusEffect: "poison",
    statusChance: 30,
    effectText: "30% chance to poison."
  },

  "sludge-bomb": {
    statusEffect: "poison",
    statusChance: 30,
    effectText: "30% chance to poison."
  },

  "poison-jab": {
    statusEffect: "poison",
    statusChance: 30,
    effectText: "30% chance to poison."
  },

  "toxic": {
    category: "status",
    power: 0,
    statusEffect: "poison",
    statusChance: 100,
    effectText: "Poisons the target."
  },

  // =====================
  // PARALYSIS MOVES
  // =====================
  "thunder-shock": {
    statusEffect: "paralysis",
    statusChance: 10,
    effectText: "10% chance to paralyze."
  },

  "thunderbolt": {
    statusEffect: "paralysis",
    statusChance: 10,
    effectText: "10% chance to paralyze."
  },

  "thunder": {
    accuracy: 85,
    statusEffect: "paralysis",
    statusChance: 30,
    effectText: "Strong Electric move. 30% chance to paralyze. Lower accuracy."
  },

  "thunder-wave": {
    category: "status",
    power: 0,
    statusEffect: "paralysis",
    statusChance: 100,
    effectText: "Paralyzes the target."
  },

  "body-slam": {
    statusEffect: "paralysis",
    statusChance: 30,
    effectText: "30% chance to paralyze."
  },

  // =====================
  // BURN MOVES
  // =====================
  "ember": {
    statusEffect: "burn",
    statusChance: 10,
    effectText: "10% chance to burn."
  },

  "flamethrower": {
    statusEffect: "burn",
    statusChance: 10,
    effectText: "10% chance to burn."
  },

  "fire-blast": {
    accuracy: 85,
    statusEffect: "burn",
    statusChance: 10,
    effectText: "Powerful Fire move. 10% burn chance. Lower accuracy."
  },

  "will-o-wisp": {
    category: "status",
    power: 0,
    statusEffect: "burn",
    statusChance: 100,
    effectText: "Burns the target."
  },

  // =====================
  // SLEEP MOVES
  // =====================
  "sleep-powder": {
    category: "status",
    power: 0,
    statusEffect: "sleep",
    statusChance: 75,
    accuracy: 75,
    effectText: "May put the target to sleep."
  },

  "hypnosis": {
    category: "status",
    power: 0,
    statusEffect: "sleep",
    statusChance: 60,
    accuracy: 60,
    effectText: "May put the target to sleep."
  },

  "yawn": {
    category: "status",
    power: 0,
    delayedStatus: {
      statusEffect: "sleep",
      turns: 1
    },
    effectText: "Target becomes sleepy and may fall asleep next round."
  },

  "rest": {
    category: "heal",
    power: 0,
    healPercent: 100,
    selfStatusEffect: "sleep",
    effectText: "Fully heals the user, then makes it sleep."
  },

  "sleep-talk": {
    category: "special-random",
    power: 0,
    effectText: "Can only be useful while asleep. Randomly uses another move."
  },

  // =====================
  // HEAL MOVES
  // =====================
  "recover": {
    category: "heal",
    power: 0,
    healPercent: 50,
    effectText: "Heals 50% of max HP."
  },

  "roost": {
    category: "heal",
    power: 0,
    healPercent: 50,
    effectText: "Heals 50% of max HP."
  },

  "soft-boiled": {
    category: "heal",
    power: 0,
    healPercent: 50,
    effectText: "Heals 50% of max HP."
  },

  "milk-drink": {
    category: "heal",
    power: 0,
    healPercent: 50,
    effectText: "Heals 50% of max HP."
  },

  "heal-pulse": {
    category: "heal",
    power: 0,
    healPercent: 35,
    effectText: "Heals HP. In Animon battle mode, it heals the user."
  },

  // =====================
  // DEFENSE MOVES
  // =====================
  "protect": {
    category: "defense",
    power: 0,
    protect: true,
    effectText: "Blocks most incoming damage this turn."
  },

  "detect": {
    category: "defense",
    power: 0,
    protect: true,
    effectText: "Avoids most incoming damage this turn."
  },

  "harden": {
    category: "defense",
    power: 0,
    selfStatChange: {
      stat: "defense",
      amount: 15,
      turns: 3
    },
    effectText: "Raises user's defense."
  },

  "iron-defense": {
    category: "defense",
    power: 0,
    selfStatChange: {
      stat: "defense",
      amount: 25,
      turns: 3
    },
    effectText: "Strongly raises user's defense."
  },

  "defense-curl": {
    category: "defense",
    power: 0,
    selfStatChange: {
      stat: "defense",
      amount: 15,
      turns: 3
    },
    effectText: "Raises user's defense."
  },

  "withdraw": {
    category: "defense",
    power: 0,
    selfStatChange: {
      stat: "defense",
      amount: 15,
      turns: 3
    },
    effectText: "Raises user's defense."
  },

  // =====================
  // BUFF MOVES
  // =====================
  "swords-dance": {
    category: "buff",
    power: 0,
    selfStatChange: {
      stat: "attack",
      amount: 25,
      turns: 3
    },
    effectText: "Greatly raises user's attack."
  },

  "agility": {
    category: "buff",
    power: 0,
    selfStatChange: {
      stat: "speed",
      amount: 20,
      turns: 3
    },
    effectText: "Raises user's speed."
  },

  "calm-mind": {
    category: "buff",
    power: 0,
    selfStatChange: {
      stat: "attack",
      amount: 15,
      turns: 3
    },
    effectText: "Raises offensive power."
  },

  "dragon-dance": {
    category: "buff",
    power: 0,
    selfStatChange: {
      stat: "attack",
      amount: 20,
      turns: 3
    },
    effectText: "Raises attack and battle momentum."
  },

  // =====================
  // DEBUFF MOVES
  // =====================
  "growl": {
    category: "debuff",
    power: 0,
    enemyStatChange: {
      stat: "attack",
      amount: -10,
      turns: 3
    },
    effectText: "Lowers enemy attack."
  },

  "tail-whip": {
    category: "debuff",
    power: 0,
    enemyStatChange: {
      stat: "defense",
      amount: -10,
      turns: 3
    },
    effectText: "Lowers enemy defense."
  },

  "leer": {
    category: "debuff",
    power: 0,
    enemyStatChange: {
      stat: "defense",
      amount: -10,
      turns: 3
    },
    effectText: "Lowers enemy defense."
  },

  "screech": {
    category: "debuff",
    power: 0,
    enemyStatChange: {
      stat: "defense",
      amount: -20,
      turns: 3
    },
    effectText: "Sharply lowers enemy defense."
  },

  "charm": {
    category: "debuff",
    power: 0,
    enemyStatChange: {
      stat: "attack",
      amount: -20,
      turns: 3
    },
    effectText: "Sharply lowers enemy attack."
  },

  // =====================
  // CHARGE MOVES — BASIC METADATA ONLY FOR NOW
  // =====================
  "dig": {
    category: "charge",
    chargeTurns: 1,
    avoidState: "underground",
    effectText: "Charges for 1 turn, then attacks. Underground avoids most attacks."
  },

  "fly": {
    category: "charge",
    chargeTurns: 1,
    avoidState: "airborne",
    effectText: "Charges for 1 turn, then attacks. Airborne avoids most attacks."
  },

  "solar-beam": {
    category: "charge",
    chargeTurns: 1,
    effectText: "Charges for 1 turn, then fires a strong attack."
  },

  "skull-bash": {
    category: "charge",
    chargeTurns: 1,
    selfStatChange: {
      stat: "defense",
      amount: 10,
      turns: 2
    },
    effectText: "Charges, raises defense, then attacks."
  },
  // MORE UNIQUE EFFECT MOVES

  "leech-seed": {
  category: "status",
  power: 0,
  statusEffect: "leech-seed",
  statusChance: 100,
  effectText: "Seeds the target. Future version: drains HP each round."
},

"absorb": {
  category: "drain",
  drainPercent: 50,
  effectText: "User heals for 50% of damage dealt."
},

"mega-drain": {
  category: "drain",
  drainPercent: 50,
  effectText: "User heals for 50% of damage dealt."
},

"giga-drain": {
  category: "drain",
  drainPercent: 50,
  effectText: "User heals for 50% of damage dealt."
},

"dream-eater": {
  category: "drain",
  drainPercent: 50,
  requiresTargetStatus: "sleep",
  effectText: "Works best against sleeping targets. Heals user."
},

"confuse-ray": {
  category: "status",
  power: 0,
  statusEffect: "confusion",
  statusChance: 100,
  effectText: "Confuses the target."
},

"supersonic": {
  category: "status",
  power: 0,
  accuracy: 55,
  statusEffect: "confusion",
  statusChance: 100,
  effectText: "May confuse the target."
},

"double-team": {
  category: "buff",
  power: 0,
  selfStatChange: {
    stat: "evasion",
    amount: 10,
    turns: 3
  },
  effectText: "Raises evasion."
},

"minimize": {
  category: "buff",
  power: 0,
  selfStatChange: {
    stat: "evasion",
    amount: 20,
    turns: 3
  },
  effectText: "Greatly raises evasion."
},

"focus-energy": {
  category: "buff",
  power: 0,
  selfStatChange: {
    stat: "critChance",
    amount: 15,
    turns: 3
  },
  effectText: "Raises critical-hit chance."
},

"meditate": {
  category: "buff",
  power: 0,
  selfStatChange: {
    stat: "attack",
    amount: 10,
    turns: 3
  },
  effectText: "Raises attack."
},

"amnesia": {
  category: "defense",
  power: 0,
  selfStatChange: {
    stat: "defense",
    amount: 20,
    turns: 3
  },
  effectText: "Greatly raises defensive power."
},

"barrier": {
  category: "defense",
  power: 0,
  selfStatChange: {
    stat: "defense",
    amount: 20,
    turns: 3
  },
  effectText: "Raises defense strongly."
},

"smokescreen": {
  category: "debuff",
  power: 0,
  enemyStatChange: {
    stat: "accuracy",
    amount: -10,
    turns: 3
  },
  effectText: "Lowers enemy accuracy."
},

"sand-attack": {
  category: "debuff",
  power: 0,
  enemyStatChange: {
    stat: "accuracy",
    amount: -10,
    turns: 3
  },
  effectText: "Lowers enemy accuracy."
},

"string-shot": {
  category: "debuff",
  power: 0,
  enemyStatChange: {
    stat: "speed",
    amount: -15,
    turns: 3
  },
  effectText: "Lowers enemy speed."
},

"scary-face": {
  category: "debuff",
  power: 0,
  enemyStatChange: {
    stat: "speed",
    amount: -20,
    turns: 3
  },
  effectText: "Sharply lowers enemy speed."
},

"recover": {
  category: "heal",
  power: 0,
  healPercent: 50,
  effectText: "Heals 50% of max HP."
},

"moonlight": {
  category: "heal",
  power: 0,
  healPercent: 50,
  effectText: "Heals 50% of max HP."
},

"synthesis": {
  category: "heal",
  power: 0,
  healPercent: 50,
  effectText: "Heals 50% of max HP."
},

"morning-sun": {
  category: "heal",
  power: 0,
  healPercent: 50,
  effectText: "Heals 50% of max HP."
},

"endure": {
  category: "defense",
  power: 0,
  endure: true,
  effectText: "Survives a knockout hit with 1 HP this turn."
},

"counter": {
  category: "counter",
  power: 0,
  effectText: "Future version: returns physical damage."
},

"mirror-coat": {
  category: "counter",
  power: 0,
  effectText: "Future version: returns special damage."
},
"dive": {
  category: "charge",
  chargeTurns: 1,
  avoidState: "underwater",
  effectText: "Charges for 1 turn underwater, then attacks."
},

"bounce": {
  category: "charge",
  chargeTurns: 1,
  avoidState: "airborne",
  statusEffect: "paralysis",
  statusChance: 30,
  effectText: "Charges into the air, then attacks. May paralyze."
},

"sky-attack": {
  category: "charge",
  chargeTurns: 1,
  avoidState: "airborne",
  effectText: "Charges for 1 turn, then attacks with great force."
},

"razor-wind": {
  category: "charge",
  chargeTurns: 1,
  effectText: "Charges for 1 turn, then attacks."
},

"phantom-force": {
  category: "charge",
  chargeTurns: 1,
  avoidState: "vanished",
  effectText: "Vanishes for 1 turn, then attacks."
},

"shadow-force": {
  category: "charge",
  chargeTurns: 1,
  avoidState: "vanished",
  effectText: "Vanishes for 1 turn, then attacks."
},

"meteor-beam": {
  category: "charge",
  chargeTurns: 1,
  selfStatChange: {
    stat: "attack",
    amount: 15,
    turns: 2
  },
  effectText: "Charges, raises power, then attacks."
},

"freeze-shock": {
  category: "charge",
  chargeTurns: 1,
  statusEffect: "paralysis",
  statusChance: 30,
  effectText: "Charges, then attacks. May paralyze."
},
"guard-swap": {
  category: "status",
  power: 0,
  effectText: "Swaps defensive power. No protect effect in Animon V1."
},
"ice-burn": {
  category: "charge",
  chargeTurns: 1,
  statusEffect: "burn",
  statusChance: 30,
  effectText: "Charges, then attacks. May burn."
}
};

function inferMoveMeta(moveName) {
  const name = String(moveName || "").toLowerCase();

  if (name.includes("poison")) {
    return {
      statusEffect: "poison",
      statusChance: 20,
      effectText: "May poison the target."
    };
  }

  if (
    name.includes("thunder") ||
    name.includes("spark") ||
    name.includes("shock")
  ) {
    return {
      statusEffect: "paralysis",
      statusChance: 10,
      effectText: "May paralyze the target."
    };
  }

  if (
    name.includes("fire") ||
    name.includes("flame") ||
    name.includes("burn")
  ) {
    return {
      statusEffect: "burn",
      statusChance: 10,
      effectText: "May burn the target."
    };
  }

  if (
    name.includes("heal") ||
    name.includes("recover") ||
    name.includes("roost")
  ) {
    return {
      category: "heal",
      power: 0,
      healPercent: 35,
      effectText: "Restores some HP."
    };
  }

 if (
  name.includes("protect") ||
  name.includes("shield")
) {
    return {
      category: "defense",
      power: 0,
      protect: true,
      effectText: "Defensive move. Blocks most incoming damage."
    };
  }

  return {
    category: "damage",
    effectText: "Basic damage move."
  };
}

function getMoveMeta(moveName) {
  return {
    ...inferMoveMeta(moveName),
    ...(MOVE_DATABASE[moveName] || {})
  };
}

module.exports = {
  MOVE_DATABASE,
  getMoveMeta
};