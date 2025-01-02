const analyzeButton = document.getElementById("analyzeButton");
const imageInput = document.getElementById("imageInput");
const uploadNotification = document.getElementById("uploadNotification");
const loadingSpinner = document.getElementById("loadingSpinner");
const uploadedCanvas = document.getElementById("uploadedCanvas");
const processedCanvas = document.getElementById("processedCanvas");
const uploadedCaption = document.getElementById("uploadedCaption");
const processedCaption = document.getElementById("processedCaption");
const objectDetails = document.getElementById("objectDetails");
const downloadButton = document.getElementById("downloadButton");

const AUTH_TOKEN = "Bearer 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";
const apiKey = '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';
const apiBase = 'https://api.groq.com/openai/v1';

async function queryHuggingFaceAPI(url, data) {
    const response = await fetch(url, {
        headers: {
            Authorization: AUTH_TOKEN,
            "Content-Type": "application/json",
        },
        method: "POST",
        body: data,
    });
    return response.json();
}

document.addEventListener("DOMContentLoaded", () => {
    // Particle Effect
    const particlesContainer = document.createElement("div");
    particlesContainer.className = "particles";
    document.body.appendChild(particlesContainer);

    const numberOfParticles = 50;
    for (let i = 0; i < numberOfParticles; i++) {
        const particle = document.createElement("div");
        particle.className = "particle";
        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.animationDelay = `${Math.random() * 5}s`;
        particle.style.width = `${Math.random() * 8 + 2}px`;
        particle.style.height = particle.style.width; // Ensure particle is a circle
        particlesContainer.appendChild(particle);
    }
});

function getRandomColor() {
    return `hsl(${Math.random() * 360}, 70%, 60%)`;
}

imageInput.addEventListener("change", () => {
    uploadNotification.style.display = imageInput.files.length > 0 ? "block" : "none";
});

async function getChatbotResponse(message) {
    const url = `${apiBase}/chat/completions`;
    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
    };

    const body = JSON.stringify({
        model: "llama-3.1-70b-versatile",
        messages: [
            { role: "system", content: "Describe the scene given by the user in one statement." },
            { role: "user", content: message },
        ],
    });

    try {
        const response = await fetch(url, { method: "POST", headers, body });
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Error:", error);
        return "Error: Could not fetch response from the chatbot.";
    }
}

async function analyzeImage() {
    const file = imageInput.files[0];
    if (!file) {
        alert("Please upload an image!");
        return;
    }

    uploadNotification.style.display = "none";
    loadingSpinner.style.display = "block";

    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;

        try {
            const ctxUploaded = uploadedCanvas.getContext("2d");
            const uploadedImage = new Image();
            uploadedImage.onload = () => {
                uploadedCanvas.width = uploadedImage.width;
                uploadedCanvas.height = uploadedImage.height;
                ctxUploaded.drawImage(uploadedImage, 0, 0);
            };
            uploadedImage.src = imageData;

            const arrayBuffer = Uint8Array.from(atob(imageData.split(",")[1]), (c) => c.charCodeAt(0));
            const objectResponse = await queryHuggingFaceAPI(
                "https://api-inference.huggingface.co/models/facebook/detr-resnet-50",
                arrayBuffer
            );

            const ctxProcessed = processedCanvas.getContext("2d");
            const processedImage = new Image();
            processedImage.onload = async () => {
                processedCanvas.width = processedImage.width;
                processedCanvas.height = processedImage.height;
                ctxProcessed.drawImage(processedImage, 0, 0);

                // Categorize objects and assign colors
                const categories = {};
                objectResponse.forEach(({ label }) => {
                    if (!categories[label]) {
                        categories[label] = { count: 0, color: getRandomColor() };
                    }
                    categories[label].count++;
                });

                // Draw bounding boxes
                objectResponse.forEach(({ label, score, box }) => {
                    const categoryColor = categories[label].color;
                    ctxProcessed.strokeStyle = categoryColor;
                    ctxProcessed.lineWidth = 2;
                    ctxProcessed.strokeRect(box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin);
                    ctxProcessed.fillStyle = categoryColor;
                    ctxProcessed.font = "16px Arial";
                    ctxProcessed.fillText(`${label} (${(score * 100).toFixed(1)}%)`, box.xmin, box.ymin - 5);
                });

                const objectDetailsHTML = Object.entries(categories)
                    .map(([label, { count }]) => `${label}: ${count}`)
                    .join(", ");

                // Get caption
                const captionResponse = await queryHuggingFaceAPI(
                    "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
                    arrayBuffer
                );

                const caption = captionResponse[0]?.generated_text || "No caption";

                // Chatbot input and response
                const chatbotInput = `The scene is: "${caption}" and object details are: ${objectDetailsHTML}.`;
                const chatbotResponse = await getChatbotResponse(chatbotInput);

                uploadedCaption.textContent = "Uploaded Image: Original view.";
                processedCaption.innerHTML = `
                    <strong>Detected Image Caption:</strong> ${chatbotResponse}
                `;
            };

            processedImage.src = imageData;


            downloadButton.onclick = () => {
                const link = document.createElement("a");
                link.download = "processed_image.png";
                link.href = processedCanvas.toDataURL();
                link.click();
            };
        } catch (error) {
            console.error(error);
            alert("An error occurred during processing.");
        } finally {
            loadingSpinner.style.display = "none";
        }
    };

    reader.readAsDataURL(file);
}



analyzeButton.addEventListener("click", analyzeImage);
