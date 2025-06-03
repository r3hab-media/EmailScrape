/*
Instructions: 
$ node scrape.js
Then, CTRL + http://localhost:3000

In the input, add URLs (comma separated) and click run.
*/

const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const https = require("https");

const app = express();
app.use(express.urlencoded({ extended: true }));
const port = 3000;

const httpsAgent = new https.Agent({
	rejectUnauthorized: false, // Bypass SSL certificate validation, use with caution
});

const urlList = "https://www.ajpl.org"; // Replace with actual URLs
const urls = urlList.split(",");

app.get("/", (req, res) => {
	res.send(`
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Email Scraper</title>
		<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
	</head>
	<body>
		<div class="container mt-5">
			<h1>Email Scraper</h1>
			<form action="/scrape" method="POST">
				<div class="mb-3">
					<label for="urls" class="form-label">Enter one or more URLs (comma-separated):</label>
					<textarea name="urls" id="urls" class="form-control" rows="4" placeholder="https://example.com, https://another.com"></textarea>
				</div>
				<button type="submit" class="btn btn-primary">Run</button>
			</form>
		</div>
	</body>
	</html>
	`);
});

app.post("/scrape", async (req, res) => {
	const inputUrls = req.body.urls || "";
	const urls = inputUrls
		.split(",")
		.map((url) => url.trim())
		.filter(Boolean);

	let results = [];
	let promises = urls.map((url) => {
		url = url.trim();
		return axios
			.get(url, {
				httpsAgent,
				headers: {
					"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
					"Accept-Language": "en-US,en;q=0.9",
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
					Referer: "https://www.google.com/",
				},
			})

			.then((response) => {
				const html = response.data;
				const $ = cheerio.load(html);
				const title = $("title").text();
				const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)\b/g;
				const emails = new Map();
				$("body")
					.text()
					.replace(emailRegex, (match) => {
						const email = match.toLowerCase();
						emails.set(email, (emails.get(email) || 0) + 1);
					});
				results.push({ url, title, emails: Array.from(emails) });
			})
			.catch((error) => {
				console.error(`Error fetching ${url}:`, error.message);
				results.push({ url, title: url, error: error.message });
			});
	});

	await Promise.all(promises);

	let htmlOutput = `
	<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<title>Emails Found</title>
		<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
		<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" rel="stylesheet">
		<script>
			function copyToClipboard(button, text) {
				navigator.clipboard.writeText(text).then(() => {
					button.innerHTML = '<i class="fas fa-check"></i> Copied';
					button.classList.add('btn-success');
					button.classList.remove('btn-outline-secondary');
					setTimeout(() => {
						button.innerHTML = 'Copy Email';
						button.classList.remove('btn-success');
						button.classList.add('btn-outline-secondary');
					}, 2000);
				}).catch(err => {
					console.error('Copy failed', err);
					button.innerText = 'Error';
				});
			}
		</script>
	</head>
	<body>
	<div class="container mt-5">
		<h1>Scrape Results</h1>
		<a href="/" class="btn btn-secondary mb-4">Back</a>
	`;

	results.forEach(({ url, title, emails, error }) => {
		htmlOutput += `
		<div class="card mb-3">
			<div class="card-header">
				<a href="${url}" target="_blank">${title}</a>
			</div>
			<ul class="list-group list-group-flush">`;
		if (emails && emails.length > 0) {
			emails.forEach(([email, count]) => {
				htmlOutput += `
				<li class="list-group-item">
					${email} (appears ${count} time${count > 1 ? "s" : ""}) 
					<button onclick="copyToClipboard(this, '${email.replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline-secondary ms-2">Copy Email</button>
				</li>`;
			});
		} else {
			htmlOutput += `<li class="list-group-item">${error || "No emails found."}</li>`;
		}
		htmlOutput += `</ul></div>`;
	});

	htmlOutput += `</div></body></html>`;
	res.send(htmlOutput);
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
