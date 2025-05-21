// IP-based Amazon redirection
fetch("https://ipapi.co/json/")
    .then(response => response.json())
    .then(data => {
        const countryCode = data.country_code;
        const asin = "B0DZZCZPC2";
        const amazonLinks = {
            US: "https://www.amazon.com/dp/" + asin,
            UK: "https://www.amazon.co.uk/dp/" + asin,
            DE: "https://www.amazon.de/dp/" + asin,
            FR: "https://www.amazon.fr/dp/" + asin,
            ES: "https://www.amazon.es/dp/" + asin,
            IT: "https://www.amazon.it/dp/" + asin,
            NL: "https://www.amazon.nl/dp/" + asin,
            JP: "https://www.amazon.co.jp/dp/" + asin,
            BR: "https://www.amazon.com.br/dp/" + asin,
            CA: "https://www.amazon.ca/dp/" + asin,
            MX: "https://www.amazon.com.mx/dp/" + asin,
            AU: "https://www.amazon.com.au/dp/" + asin,
            IN: "https://www.amazon.in/dp/" + asin,
        };
        const url = amazonLinks[countryCode] || amazonLinks.US;
        document.getElementById("amazon-button").href = url;
        document.getElementById("amazon-button-top").href = url;
    })
    .catch(error => {
        console.error("Error detecting country:", error);
        // Keep default US link on error
    });
