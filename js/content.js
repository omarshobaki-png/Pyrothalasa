/* =====================================================================
   THE HYDROGEN GARDEN  -  all science content lives in this file.
   Edit text, numbers and sources here; the page code reads from it.

   Tags used on cards:
     evidence   = backed by a cited real-world observation
     assumption = our design choice / simplification (no direct evidence)
     fiction    = an invented organism or name, based on an Earth analog
   ===================================================================== */

window.DIVE = {

  meta: {
    title: "The Hydrogen Garden",
    moonName: "Pyrothalasa",
    teamName: "Shay Rafe3",
    members: ["Omar Shoubaki", "Ahmad Sulieman", "Omar Takhman", "Alameen Abufkheida", "Mahdi Alsheikh", "Mohammad Humidan"],
    reportUrl: "ShayRafe3_Challenge-A_Report.pdf",
    videoUrl: "https://drive.google.com/file/d/1dLfS1ZW1qGngDrTg4QJEw0VGyg4zmLMQ/view",
    aiUse: "ChatGPT (Codex) helped with writing and formatting the report. Claude reviewed the report against the rubric. Claude Code assisted with programming and ElevenLabs with narration audio. Mahdi edited the video in Adobe After Effects.",
    tagline: "Dive 50 km into a fictional ocean moon where life runs without sunlight."
  },

  /* Physical parameters used by the live gauges.
     Change these and the gauges + labels update automatically. */
  params: {
    iceKm: 20,              // ice shell thickness (Enceladus: ~20-25 km avg, NASA)
    oceanKm: 30,            // ocean depth (Enceladus: tens of km, Thomas 2016)
    gravity: 0.113,
    rhoIce: 920,            // kg/m^3
    rhoWater: 1030,         // kg/m^3, salty water
    surfaceTempC: -201,     // NASA: about -201 C at Enceladus' surface
    iceBaseTempC: 0,        // ice meets liquid water
    gardenWaterTempC: 8,    // ASSUMPTION: water warmed a little by the vent field
    ventFluidC: "40-90",    // Lost City vent fluids (Kelley 2005)
    sunlightPct: 1.1,       // 1 / 9.5^2 of Earth's sunlight (inverse-square law)
    lightEfoldM: 1.5,       // ASSUMPTION (illustrative): light drops ~e-fold per 1.5 m of ice
    chimneyM: 60            // chimney height (Lost City: up to ~60 m)
  },

  /* Labels along the dive. Position with either:
       sky: <position in the sky, in screen heights from the top, 0..1.3 (the surface is at 1.3)>
       depth: <metres below the surface>
       aboveFloor: <metres above the seafloor> (used in the garden)
     side: "left" | "right" | "center"
     kind: "note" (small line) | "zone" (big heading) | "level" (food-web level)
     card: id of an info card (makes the label tappable) */
  markers: [
    { sky: 0.95, side: "left",  kind: "note", text: "Saturn fills the sky. Sunlight here is only ~1% of Earth's.", card: "sunlight" },
    { sky: 1.14, side: "right", kind: "note", text: "Jets of water spray from cracks near the south pole", card: "plume" },

    { depth: 0,     side: "left",  kind: "zone", text: "SURFACE · about −200 °C · no air", card: "surface" },
    { depth: 3,     side: "right", kind: "note", text: "the last of the sunlight fades", card: "darkness" },
    { depth: 1000,  side: "left",  kind: "note", text: "1 km: still solid ice. Our probe melts its way down", card: "probe" },
    { depth: 9000,  side: "right", kind: "zone", text: "THE ICE SHELL · ~20 km thick", card: "iceshell" },
    { depth: 17000, side: "left",  kind: "note", text: "warming up: −200 °C at the top, ~0 °C at the bottom", card: "temperature" },

    { depth: 20500, side: "right", kind: "zone", text: "THE DARK OCEAN · global and salty", card: "ocean" },
    { depth: 27000, side: "left",  kind: "note", text: "pressure check: lower than you'd think", card: "pressure" },
    { depth: 34000, side: "right", kind: "note", text: "no food falls from above. The open ocean is almost empty", card: "nosnow" },
    { depth: 42000, side: "left",  kind: "note", text: "hydrogen in the water: we're getting close", card: "engine" },

    { aboveFloor: 58, side: "left",  kind: "zone", text: "THE HYDROGEN GARDEN · white chimneys up to 60 m tall", card: "chimneys" },
    { aboveFloor: 50, side: "right", kind: "note", text: "why not copy Earth's famous black-smoker vents?", card: "whynot" },
    { aboveFloor: 45, side: "left",  kind: "level", level: 1, text: "Methane-makers: microbes living inside the warm chimneys", card: "methanogens" },
    { aboveFloor: 38, side: "right", kind: "note", text: "no sunlight means no oxygen. So how can anything live here?", card: "nooxygen" },
    { aboveFloor: 30, side: "left",  kind: "level", level: 2, text: "Grazers: single-celled, they eat the microbes", card: "grazers" },
    { aboveFloor: 21, side: "right", kind: "note", text: "magnified ×300: everything alive here is microscopic", card: "microscopic" },
    { aboveFloor: 14, side: "left",  kind: "level", level: 3, text: "Shadowfin: the top predator, smaller than 1 mm", card: "predator" },
    { aboveFloor: 6, side: "right", kind: "note", text: "why is the top predator so small?", card: "energy" },
    { aboveFloor: 0, side: "center",kind: "zone", text: "SEAFLOOR · 50 km down", card: "shutdown" }
  ],

  /* Where the animated organisms are drawn (aboveFloor in m, x = fraction of screen width) */
  creatures: {
    // stage: "dividing" = a grazer splitting in two; "larva" / "eggs" = young Shadowfin (see each card's life cycle)
    grazers:    [ { aboveFloor: 40, x: 0.42 }, { aboveFloor: 36, x: 0.57, stage: "dividing" }, { aboveFloor: 33, x: 0.592 }, { aboveFloor: 28, x: 0.676 },
                  { aboveFloor: 25, x: 0.343 }, { aboveFloor: 20, x: 0.56 }, { aboveFloor: 11, x: 0.44, stage: "dividing" } ],
    predator:   [ { aboveFloor: 15, x: 0.34 }, { aboveFloor: 9, x: 0.58, stage: "larva" }, { aboveFloor: 4, x: 0.41, stage: "eggs" } ]
  },

  cards: {
    sunlight: {
      title: "Too far for sunlight",
      body: [
        "Our moon orbits Saturn, which is 9.5 times farther from the Sun than Earth. Light spreads out as it travels, so it gets weaker with the square of the distance: 1 ÷ 9.5² ≈ 1/90, about 1% of the sunlight Earth gets.",
        "That weak light also can't get through kilometres of ice. Any life in the ocean below has to run on something else."
      ],
      evidence: ["Saturn is 9.5 AU from the Sun (NASA).", "Light weakens with the square of the distance (inverse-square law)."],
      assumptions: ["Our fictional moon orbits Saturn, like Enceladus does."],
      sources: ["nasaSaturn"]
    },
    plume: {
      title: "Clues spraying into space",
      body: [
        "On the real moon Enceladus, the Cassini spacecraft flew through jets of water coming from cracks near the south pole and sampled them.",
        "It found salt, tiny silica grains that only form where hot water (above about 90 °C) reacts with rock, and hydrogen gas. Together these suggest hydrothermal vents on the seafloor. Our fictional moon copies this setup."
      ],
      evidence: [
        "Salts in Enceladus' ice grains point to a salty ocean (Postberg et al. 2009).",
        "Silica nanograins point to hot water–rock reactions (Hsu et al. 2015; NASA).",
        "Molecular hydrogen in the plume (Waite et al. 2017)."
      ],
      assumptions: ["Our moon has the same kind of jets and seafloor chemistry as Enceladus."],
      sources: ["postberg2009", "hsu2015", "waite2017", "nasaEnceladus"]
    },
    surface: {
      title: "The frozen surface",
      body: [
        "The surface is bright ice at about −200 °C, with almost no atmosphere. Nothing could live here, so we go down.",
      ],
      evidence: ["Enceladus' surface is about −201 °C (NASA)."],
      assumptions: ["Our moon has the same surface temperature."],
      sources: ["nasaEnceladus"]
    },
    darkness: {
      title: "Lights out",
      body: [
        "A few metres of ice absorbs what little sunlight arrives. From here to the seafloor, 50 km down, there is no natural light at all.",
        "The glow you see around the probe is its own lamp, added so you can see. It is not natural light."
      ],
      evidence: ["Ice and water absorb light, and only about 1% of Earth's sunlight arrives in the first place."],
      assumptions: ["The exact depth where light runs out is illustrative. Our light gauge uses a simple made-up fade rate, not a measurement."],
      sources: ["nasaSaturn"]
    },
    probe: {
      title: "Our guide: a melting probe",
      body: [
        "To take you down, we imagined a probe that melts through the ice with a heated nose and trails a cable back to the surface.",
        "It's only a storytelling device for this page. It isn't part of our ecosystem design."
      ],
      evidence: [],
      assumptions: ["The probe and its lamp are our invention for the visual story."],
      sources: []
    },
    iceshell: {
      title: "A shell of ice, ~20 km thick",
      body: [
        "Measurements of Enceladus' gravity and of the slight wobble it makes as it orbits Saturn show that a global ocean lies under the ice. NASA describes the shell as about 20–25 km thick on average, and as thin as 1–5 km near the south pole.",
        "We picked 20 km for our moon."
      ],
      evidence: ["Global ocean under the ice (Thomas et al. 2016).", "Ice ~20–25 km thick on average, 1–5 km at the south pole (NASA)."],
      assumptions: ["Our moon's shell is exactly 20 km thick everywhere we dive."],
      sources: ["thomas2016", "nasaEnceladus"]
    },
    temperature: {
      title: "From −200 °C to 0 °C",
      body: [
        "The top of the ice touches space at about −200 °C. The bottom touches liquid water at about 0 °C. Heat from inside the moon flows up through the ice.",
        "Our temperature gauge draws this as a straight line, which is a simplification. The real profile is not a straight line."
      ],
      evidence: ["Surface ~−201 °C (NASA); liquid water lies under the ice (Thomas et al. 2016)."],
      assumptions: ["A straight-line temperature change through the ice."],
      sources: ["nasaEnceladus", "thomas2016"]
    },
    ocean: {
      title: "A global, salty ocean",
      body: [
        "Below the ice is liquid water that wraps around the whole moon. Salt in the plume grains tells us the real Enceladus ocean is salty.",
        "We gave our moon an ocean 30 km deep."
      ],
      evidence: ["Global ocean (Thomas et al. 2016).", "Sodium salts from the ocean found in ice grains (Postberg et al. 2009)."],
      assumptions: ["Ocean depth of 30 km, and saltiness similar to Enceladus."],
      sources: ["thomas2016", "postberg2009"]
    },
    pressure: {
      title: "Deep, but not crushing",
      body: [
        "Pressure comes from the weight of the ice and water above you, and weight depends on gravity. Our moon's gravity is only about 1% of Earth's (0.113 m/s²).",
        "So even at the seafloor, 50 km down, the pressure is only about 56 bar. On Earth you'd feel that just ~550 m deep. Watch the pressure gauge: we calculate it as density × gravity × depth."
      ],
      evidence: ["Enceladus' mass and radius give a surface gravity of ~0.113 m/s² (JPL satellite parameters: GM = 7.21 km³/s²)."],
      assumptions: ["We keep gravity the same all the way down. In reality it changes slightly with depth.", "Ice density 920 kg/m³, salty-water density 1,030 kg/m³."],
      sources: ["jplSat"]
    },
    nosnow: {
      title: "No food from above",
      body: [
        "In Earth's deep sea, many animals live on 'marine snow': bits of dead plankton and waste sinking down from the sunlit surface.",
        "Here nothing grows at the top, so nothing falls. The open water is almost empty, and life has to cluster where chemical energy comes out of the seafloor."
      ],
      evidence: ["Earth's deep-sea food webs depend heavily on marine snow from the surface (NOAA)."],
      assumptions: ["Our ocean has no other food source in open water."],
      sources: ["noaaMarineSnow"]
    },
    engine: {
      title: "The engine: rock + water = hydrogen",
      body: [
        "Deep down, seawater soaks into iron-rich rock, such as the green mineral olivine. The two react (geologists call it serpentinisation) and release hydrogen gas (H₂).",
        "Why the supply could last: Saturn's changing pull can warm the moon and keep water moving through rock (tidal heating). A model of Enceladus shows how that could work. Earth's Lost City vents have been active for at least 30,000 years. We assume our vent keeps reaching fresh rock."
      ],
      evidence: [
        "Serpentinisation powers Earth's Lost City vent field (Kelley et al. 2005).",
        "Hydrogen in Enceladus' plume suggests this is happening there (Waite et al. 2017).",
        "Tidal heating can power long-lasting hydrothermal activity in Enceladus' core (Choblet et al. 2017).",
        "Lost City has been venting for at least 30,000 years (Früh-Green et al. 2003)."
      ],
      assumptions: ["Water keeps circulating through rock and supplies enough hydrogen.", "Our vent keeps reaching fresh rock."],
      sources: ["kelley2005", "waite2017", "choblet2017", "fruhgreen2003"]
    },
    chimneys: {
      title: "The Hydrogen Garden",
      body: [
        "Our one habitat zone is a field of white carbonate chimneys on the seafloor. Warm, hydrogen-rich, very alkaline fluid seeps out of them.",
        "It's modelled on Lost City, a real vent field in the Atlantic Ocean, where chimneys grow up to about 60 m tall and vent fluid reaches about 90 °C. In our model the open ocean is near freezing and the water around the chimneys is about 8 °C."
      ],
      evidence: ["Lost City: carbonate chimneys up to ~60 m, fluids ~40–90 °C, high pH (Kelley et al. 2005)."],
      assumptions: ["Our garden's chimneys and fluids match Lost City's."],
      sources: ["kelley2005"]
    },
    whynot: {
      title: "Why not copy Earth's famous vents?",
      body: [
        "Earth's best-known vent animals, like giant tubeworms, rely on microbes that use hydrogen sulfide plus oxygen. But the oxygen in Earth's deep sea comes from photosynthesis at the sunlit surface. Those 'sunless' ecosystems still depend on the Sun.",
        "On a moon with no sunlight there is no such oxygen supply. So we rejected that design and chose microbes that use hydrogen and carbon dioxide, which need no oxygen at all."
      ],
      evidence: [
        "NOAA writes the common vent chemosynthesis reaction as CO₂ + 4H₂S + O₂ → CH₂O + 4S + 3H₂O. It needs oxygen, and on Earth photosynthesis is what makes oxygen (NOAA fact sheet).",
        "Vent tubeworms rely on bacteria that use hydrogen sulfide (NOAA poster).",
        "Hydrogen and CO₂ are both present in Enceladus' plume (Waite et al. 2017)."
      ],
      assumptions: ["Our ocean has no significant source of dissolved oxygen."],
      sources: ["noaaFactSheet", "noaaPoster", "waite2017"]
    },
    methanogens: {
      title: "Level 1 · Methane-makers",
      body: [
        "The base of the food web. These microbes combine hydrogen with carbon dioxide and use the energy released to grow:",
        "CO₂ + 4H₂ → CH₄ (methane) + 2H₂O",
        "They live as slimy films (biofilms) in the warm, porous insides of the chimneys, where hydrogen from the vent meets ocean water carrying carbon dioxide. No sunlight and no oxygen are needed."
      ],
      evidence: [
        "Microbes related to methane-cycling Archaea thrive in the warm porous interiors of Lost City's chimneys (Kelley et al. 2005).",
        "An Earth methane-maker made methane at 50 bar in an Enceladus-inspired lab test (Taubner et al. 2018)."
      ],
      assumptions: [
        "That such microbes exist on our moon. Habitable does not mean inhabited.",
        "Warm pores contain enough H₂ and dissolved CO₂ for growth. Some Lost City vent fluids contain little dissolved inorganic carbon (Brazelton et al. 2006), so we assume enough CO₂ from the ocean reaches the same pores as the H₂."
      ],
      lifeCycle: {
        steps: ["Takes in H₂ and CO₂ and grows", "Copies itself and splits into two cells", "The new cells join the slimy film in the pores"],
        note: "Earth's methane-makers are single cells that multiply by splitting in two. On our moon this is an assumption, and it only works while the vent keeps bringing H₂."
      },
      sources: ["kelley2005", "taubner2018", "waite2017", "brazelton2006"]
    },
    nooxygen: {
      title: "Life without oxygen",
      body: [
        "On Earth, almost all the oxygen in the ocean comes from photosynthesis, which needs sunlight. Our moon has no sunlight, so we give its ocean no oxygen at all.",
        "That rules out big animals: Earth's animals breathe oxygen. But a study reported tiny animals called loriciferans living in mud with no oxygen, at the bottom of a deep Mediterranean basin. Their ability to complete a life cycle there is debated.",
        "So our whole food web is built from things that live without oxygen: microbes, single-celled grazers and one tiny animal."
      ],
      evidence: [
        "A study reported tiny animals called loriciferans living without oxygen (Danovaro et al. 2010). Whether they complete a life cycle there is debated (Bernhard et al. 2015).",
        "Earth's deep-sea vent chemistry that uses oxygen depends on oxygen made by photosynthesis (NOAA fact sheet)."
      ],
      assumptions: [
        "Our grazers and Shadowfin live and feed without oxygen.",
        "Our ocean has no oxygen source. A little oxygen could come from the surface ice, as at Europa, but we leave that out."
      ],
      sources: ["danovaro2010", "bernhard2015", "noaaFactSheet"]
    },
    microscopic: {
      title: "Why you need a microscope here",
      body: [
        "Every living thing in the garden is microscopic. We built the food web only from kinds of life reported without oxygen on Earth: microbes, single cells and tiny loriciferans.",
        "The creatures on screen are drawn about 300 times larger than life so you can see them. The chimneys are drawn at their real scale."
      ],
      evidence: ["The animals reported living without oxygen are tiny loriciferans (Danovaro et al. 2010; debated by Bernhard et al. 2015)."],
      assumptions: ["The ×300 magnification is a drawing choice, not a measurement."],
      sources: ["danovaro2010", "bernhard2015"]
    },
    grazers: {
      title: "Level 2 · Grazers",
      body: [
        "Single-celled creatures covered in tiny beating hairs (cilia). They swim in the cooler water along the chimney walls and swallow microbes whole.",
        "Each one is a single cell, far too small to see without a microscope."
      ],
      evidence: [
        "Some single-celled organisms with a nucleus (protozoa) live permanently without oxygen (Danovaro et al. 2010).",
        "Vent microbes are eaten by other organisms, forming the base of the food web (NOAA fact sheet)."
      ],
      assumptions: ["Grazers are fictional, based on Earth's oxygen-free single-celled organisms. We assume they eat the methane-makers.", "We do not yet know whether grazers can grow on vent microbes in salty, oxygen-free water."],
      lifeCycle: {
        steps: ["Swims along the chimney and swallows microbes", "Grows bigger", "Splits into two grazers"],
        note: "Fiction, modelled on Earth's single-celled protozoa, which multiply by splitting in two. Whether grazers could survive and reproduce on vent microbes is untested: a later lab feeding test would check it."
      },
      sources: ["danovaro2010", "noaaFactSheet"]
    },
    predator: {
      title: "Level 3 · Shadowfin",
      body: [
        "The spiny predator of the garden eats grazers, and it is still under 1 mm long: about the size of a grain of salt.",
        "It has a spiny head, a vase-shaped shell and no eyes, because there is no light. We imagine it finding prey by sensing the chemistry of the water and the movement of other organisms."
      ],
      evidence: [
        "A study reported tiny loriciferans living without oxygen (Danovaro et al. 2010); whether they complete a life cycle there is debated (Bernhard et al. 2015). Shadowfin is based on them.",
        "Only about 10% of energy passes from one food-web level to the next (Pauly & Christensen 1995), which limits how big the top animal can be."
      ],
      assumptions: ["Shadowfin, its size and its senses are fictional. We don't know what Earth's oxygen-free loriciferans eat; we assume ours eats grazers.", "We do not yet know whether a predator like Shadowfin could live there."],
      lifeCycle: {
        steps: ["A tiny egg rests near the chimney base", "A larva hatches and grows", "The adult hunts grazers and lays eggs"],
        note: "Fiction, modelled on Earth's loriciferans, which grow from a larva into an adult. Whether loriciferans can complete their life cycle without oxygen is debated (Danovaro et al. 2010; Bernhard et al. 2015)."
      },
      sources: ["danovaro2010", "bernhard2015", "pauly1995"]
    },
    energy: {
      title: "Why the top predator is small",
      special: "energy",
      body: [
        "Energy is lost at every step of a food web, as heat, movement and waste. On Earth, roughly 10% passes from one level to the next on average.",
        "Imagine the microbes capture 1,000 energy coins:"
      ],
      after: [
        "Only about 10 coins reach Shadowfin. That's why our food web has only three levels and its top animal is microscopic.",
        "Organisms use energy to live and release heat. Uneaten food, dead cells and waste can feed decomposer bacteria."
      ],
      evidence: ["Average transfer efficiency of ~10% between levels (Pauly & Christensen 1995)."],
      assumptions: ["The coins illustrate an Earth average. The garden's actual transfer is unknown: we have no measurement of its hydrogen supply or of how much energy reaches the predator."],
      sources: ["pauly1995"]
    },
    shutdown: {
      title: "What if the hydrogen stopped?",
      body: [
        "Everything here depends on the chimneys venting hydrogen. If hydrogen stops flowing, methane-makers make less new food. Grazers then have less to eat, followed by Shadowfin. The food web could shrink or collapse.",
        "Earth's vent communities are similarly fragile: they depend completely on their vents. Life would only continue where new vents open and get colonised."
      ],
      evidence: ["NOAA describes hydrothermal vents as short-lived, and their food webs rest on microbes using the vent chemicals (NOAA poster)."],
      assumptions: ["The order of collapse and the recolonisation of new vents are our reasoning, not observations from another world."],
      sources: ["noaaPoster", "kelley2005"]
    }
  },

  /* End-of-dive panel */
  limits: [
    "A real ocean world could have conditions that support life. Whether any life exists there remains an open question.",
    "Our organisms are invented, based on Earth analogs. Life elsewhere could be very different.",
    "Carbon supply: some Lost City vent fluids contain little dissolved inorganic carbon. We assume enough CO₂ from the ocean reaches the same pores as H₂ (Brazelton et al. 2006).",
    "Survival and feeding: we do not yet know whether grazers can grow on the vent microbes in salty, oxygen-free water, or whether a predator like Shadowfin could live there (Danovaro et al. 2010; Bernhard et al. 2015).",
    "Energy budget: we have no measurement of the garden's hydrogen supply or how much energy reaches the predator. The 10% rule is an Earth average (Pauly & Christensen 1995).",
    "Our gauges use simplified physics: constant gravity, straight-line ice temperature, illustrative light fade."
  ],
  tests: [
    "Lab check: a microbiology lab could grow Earth methane-makers in matched warm, salty, oxygen-free chambers at about 56 bar, with and without H₂. More methane and more cells over time with H₂ than without it would support the first living level. A chamber with no cells would check whether methane forms without microbes. A later feeding test would check whether grazers survive and reproduce on those microbes (Taubner et al. 2018).",
    "Classroom check: a science teacher reviews the dive, and five students aged 14 to 18 take the short quiz before and after. The aim: four of five can trace the energy path, explain one survival condition and predict what happens if hydrogen stops.",
    "What to look for in a real vent: finding H₂ and dissolved CO₂ together in warm, oxygen-free water would make the habitat more plausible."
  ],

  sources: {
    waite2017:   { cite: "Waite, J. H. et al. (2017). Cassini finds molecular hydrogen in the Enceladus plume: Evidence for hydrothermal processes. Science, 356, 155–159.", url: "https://doi.org/10.1126/science.aai8703", type: "peer" },
    hsu2015:     { cite: "Hsu, H.-W. et al. (2015). Ongoing hydrothermal activities within Enceladus. Nature, 519, 207–210.", url: "https://doi.org/10.1038/nature14262", type: "peer" },
    kelley2005:  { cite: "Kelley, D. S. et al. (2005). A serpentinite-hosted ecosystem: The Lost City hydrothermal field. Science, 307, 1428–1434.", url: "https://doi.org/10.1126/science.1102556", type: "peer" },
    taubner2018: { cite: "Taubner, R.-S. et al. (2018). Biological methane production under putative Enceladus-like conditions. Nature Communications, 9, 748.", url: "https://doi.org/10.1038/s41467-018-02876-y", type: "peer" },
    pauly1995:   { cite: "Pauly, D. & Christensen, V. (1995). Primary production required to sustain global fisheries. Nature, 374, 255–257.", url: "https://doi.org/10.1038/374255a0", type: "peer" },
    postberg2009:{ cite: "Postberg, F. et al. (2009). Sodium salts in E-ring ice grains from an ocean below the surface of Enceladus. Nature, 459, 1098–1101.", url: "https://doi.org/10.1038/nature08046", type: "peer" },
    choblet2017: { cite: "Choblet, G. et al. (2017). Powering prolonged hydrothermal activity inside Enceladus. Nature Astronomy, 1, 841–847.", url: "https://doi.org/10.1038/s41550-017-0289-8", type: "peer" },
    thomas2016:  { cite: "Thomas, P. C. et al. (2016). Enceladus's measured physical libration requires a global subsurface ocean. Icarus, 264, 37–47.", url: "https://doi.org/10.1016/j.icarus.2015.08.037", type: "peer" },
    danovaro2010:{ cite: "Danovaro, R. et al. (2010). The first Metazoa living in permanently anoxic conditions. BMC Biology, 8, 30.", url: "https://doi.org/10.1186/1741-7007-8-30", type: "peer" },
    fruhgreen2003: { cite: "Früh-Green, G. L. et al. (2003). 30,000 years of hydrothermal activity at the Lost City vent field. Science, 301, 495–498.", url: "https://doi.org/10.1126/science.1085582", type: "peer" },
    bernhard2015: { cite: "Bernhard, J. M. et al. (2015). Metazoans of redoxcline sediments in Mediterranean deep-sea hypersaline anoxic basins. BMC Biology, 13, 105.", url: "https://doi.org/10.1186/s12915-015-0213-6", type: "peer" },
    brazelton2006: { cite: "Brazelton, W. J. et al. (2006). Methane- and sulfur-metabolizing microbial communities dominate the Lost City hydrothermal field ecosystem. Applied and Environmental Microbiology, 72, 6257–6270.", url: "https://doi.org/10.1128/AEM.00574-06", type: "peer" },
    boetius2000: { cite: "Boetius, A. et al. (2000). A marine microbial consortium apparently mediating anaerobic oxidation of methane. Nature, 407, 623–626.", url: "https://doi.org/10.1038/35036572", type: "peer" },
    jplSat:      { cite: "NASA/JPL Solar System Dynamics. Planetary satellite physical parameters.", url: "https://ssd.jpl.nasa.gov/sats/phys_par/", type: "agency" },
    nasaEnceladus: { cite: "NASA Science. Enceladus (moon overview).", url: "https://science.nasa.gov/saturn/moons/enceladus/", type: "agency" },
    nasaSaturn:  { cite: "NASA Science. Saturn: Facts.", url: "https://science.nasa.gov/saturn/facts/", type: "agency" },
    nasaOceanWorlds: { cite: "NASA (2017). NASA missions provide new insights into 'ocean worlds' in our solar system.", url: "https://science.nasa.gov/missions/cassini/nasa-missions-provide-new-insights-into-ocean-worlds-in-our-solar-system-2/", type: "agency" },
    noaaMarineSnow: { cite: "NOAA National Ocean Service. What is marine snow?", url: "https://oceanservice.noaa.gov/facts/marinesnow.html", type: "agency" },
    noaaFactSheet: { cite: "NOAA Ocean Exploration / Deep Ocean Education Project. Chemosynthesis fact sheet.", url: "https://oceanexplorer.noaa.gov/edu/materials/chemosynthesis-fact-sheet.pdf", type: "agency" },
    noaaPoster:  { cite: "NOAA Ocean Exploration. Life Beyond Light: hydrothermal vents and cold seeps (poster).", url: "https://oceanexplorer.noaa.gov/edu/materials/LifeBeyondLight-poster.pdf", type: "agency" }
  }
};
