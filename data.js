const subjectsMap = {
    "Mathematics": ["Real Numbers", "Polynomials", "Triangles"],
    "Science": ["Chemical Reactions", "Life Processes", "Light"],
    "Social Science": ["Rise of Nationalism in Europe", "Power Sharing"]
};

const pyqData = [
    // Mathematics - Real Numbers
    {
        id: "m_rn_1",
        subject: "Mathematics",
        chapter: "Real Numbers",
        year: "2023",
        topic: "HCF & LCM",
        question: "Find the HCF of 96 and 404 by the prime factorization method. Hence, find their LCM.",
        image: null,
        solution: "Prime factorization: 96 = 2^5 × 3, 404 = 2^2 × 101.<br>HCF = 2^2 = 4.<br>LCM = (96 × 404) / 4 = 9696."
    },
    {
        id: "m_rn_2",
        subject: "Mathematics",
        chapter: "Real Numbers",
        year: "2022",
        topic: "Irrationality",
        question: "Prove that √5 is an irrational number.",
        image: null,
        solution: "Let us assume √5 is rational, so √5 = a/b where a, b are coprimes. Squaring both sides: 5 = a²/b² => a² = 5b². Thus 5 divides a². This implies 5 divides a. Let a = 5c. Then (5c)² = 5b² => 25c² = 5b² => b² = 5c². Thus 5 divides b. This contradicts that a and b are coprime. Hence, √5 is irrational."
    },
    // Mathematics - Triangles
    {
        id: "m_tr_1",
        subject: "Mathematics",
        chapter: "Triangles",
        year: "2021",
        topic: "Similarity",
        question: "In the given figure, if LM || CB and LN || CD, prove that AM/AB = AN/AD.",
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Similar_triangles.svg/300px-Similar_triangles.svg.png",
        solution: "In triangle ABC, LM || CB. By Basic Proportionality Theorem (BPT), AM/MB = AL/LC. Therefore, AM/AB = AL/AC. <br>In triangle ADC, LN || CD. By BPT, AN/ND = AL/LC. Therefore, AN/AD = AL/AC.<br>From both equations, AM/AB = AN/AD."
    },
    // Science - Chemical Reactions
    {
        id: "s_cr_1",
        subject: "Science",
        chapter: "Chemical Reactions",
        year: "2023",
        topic: "Balancing Equations",
        question: "Write the balanced chemical equation for the following reaction: Zinc + Silver nitrate → Zinc nitrate + Silver. Also state the type of reaction.",
        image: null,
        solution: "Balanced equation: Zn (s) + 2AgNO3 (aq) → Zn(NO3)2 (aq) + 2Ag (s)<br>Type of reaction: Displacement reaction, because Zinc is more reactive than Silver and displaces it from its salt solution."
    },
    // Science - Light
    {
        id: "s_li_1",
        subject: "Science",
        chapter: "Light",
        year: "2020",
        topic: "Ray Diagrams",
        question: "A convex lens forms a real and inverted image of a needle at a distance of 50 cm from it. Where is the needle placed in front of the convex lens if the image is equal to the size of the object? Also, find the power of the lens.",
        image: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Lens3.svg/320px-Lens3.svg.png",
        solution: "Since the image is real, inverted, and of the same size, the object is placed at 2F. <br>Given, v = +50 cm. So, u = -50 cm. <br>1/f = 1/v - 1/u = 1/50 - 1/(-50) = 2/50 = 1/25. <br>f = +25 cm = +0.25 m. <br>Power P = 1/f(in meters) = +4 D."
    },
    // Social Science - Nationalism
    {
        id: "ss_rn_1",
        subject: "Social Science",
        chapter: "Rise of Nationalism in Europe",
        year: "2019",
        topic: "Unification",
        question: "Briefly trace the process of German unification.",
        image: null,
        solution: "1. Nationalist feelings were widespread among middle-class Germans in 1848.<br>2. Prussia took on the leadership of the movement for national unification.<br>3. Chief Minister Otto von Bismarck was the architect of this process, carried out with the help of the Prussian army and bureaucracy.<br>4. Three wars over seven years with Austria, Denmark, and France ended in Prussian victory.<br>5. In January 1871, the Prussian king, William I, was proclaimed German Emperor."
    }
];
