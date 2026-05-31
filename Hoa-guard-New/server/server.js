const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3000;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Check if Stripe is configured
const isStripeConfigured = !!(STRIPE_SECRET_KEY && STRIPE_PUBLISHABLE_KEY);
let stripe = null;

if (isStripeConfigured) {
  stripe = require('stripe')(STRIPE_SECRET_KEY);
  console.log("Stripe API client successfully initialized.");
} else {
  console.log("Stripe is running in mock fallback mode (No keys found in server/.env).");
}

// Check if OpenAI is configured
const { OpenAI } = require('openai');
const isOpenAIConfigured = !!OPENAI_API_KEY;
let openai = null;

if (isOpenAIConfigured) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  console.log("OpenAI API client successfully initialized.");
} else {
  console.log("OpenAI is running in mock fallback mode (No keys found in server/.env).");
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    stripe_enabled: isStripeConfigured,
    openai_enabled: isOpenAIConfigured,
    timestamp: new Date().toISOString()
  });
});

// Config endpoint to share configuration with the frontend securely
app.get('/config', (req, res) => {
  res.json({
    stripe_enabled: isStripeConfigured,
    publishable_key: STRIPE_PUBLISHABLE_KEY || null,
    openai_enabled: isOpenAIConfigured
  });
});

// Endpoint to create a Payment Intent
app.post('/create-payment-intent', async (req, res) => {
  const { amount, currency, planName } = req.body;

  if (!isStripeConfigured) {
    return res.status(200).json({
      mock: true,
      message: "Stripe is not configured on this server. Proceeding in mock simulation mode.",
      clientSecret: "mock_secret_" + Math.random().toString(36).substring(2, 11)
    });
  }

  try {
    // Create a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // in cents (e.g. 999 for $9.99)
      currency: currency || 'usd',
      metadata: {
        plan: planName || 'Protection Plus'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error("Error creating PaymentIntent:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to analyze property facade using OpenAI GPT-4o Vision
app.post('/analyze-property', async (req, res) => {
  const { image } = req.body;

  if (!isOpenAIConfigured) {
    return res.status(200).json({
      mock: true,
      message: "OpenAI API is not configured. Running in simulated mockup scan mode."
    });
  }

  if (!image) {
    return res.status(400).json({ error: "Missing image parameter" });
  }

  try {
    // Extract base64 part
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert HOA inspector and compliance officer. Analyze the user's front yard image for standard HOA covenant violations.
The neighborhood is Shady Oaks. Typical rules include:
- Lawn Height (must be under 4.0 inches. If it looks higher, flag it).
- Trash Bins (must not be visible from the street except on collection day, which is Tuesday evening to Wednesday evening).
- Peeling exterior paint (peeling wood or faded panels should be flagged).
- Visible weeds, trash on lawn, or parked RVs/boats on driveways.

Analyze the image and return a JSON object (strictly raw JSON, no markdown formatting block) containing:
1. status: "clean", "warning", or "violation"
2. summary: A short description of the result (e.g. "All zones compliant" or "2 compliance flags found").
3. issues: An array of issues found, each having:
   - zone: "grass", "trash", "paint", or "general"
   - title: Short issue title (e.g. "Overgrown Grass")
   - description: Detail of what was observed (e.g. "Lawn height estimated at 6.5 inches, exceeding 4-inch limit").
   - action: Action required by the homeowner (e.g. "Mow Lawn", "Store Bin").
   - severity: "red", "yellow", or "green"`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Please inspect this property facade for HOA violations:" },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const resultText = response.choices[0].message.content;
    const resultJson = JSON.parse(resultText);
    res.json(resultJson);
  } catch (error) {
    console.error("OpenAI Scanner Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to generate an appeal letter from an uploaded document image using OpenAI GPT-4o
app.post('/generate-appeal', async (req, res) => {
  const { image, textContent } = req.body;

  if (!isOpenAIConfigured) {
    return res.status(200).json({
      mock: true,
      message: "OpenAI is not configured. Returning mock appeal document."
    });
  }

  try {
    let userContent = [];
    if (textContent) {
      userContent.push({ type: "text", text: `Analyze this HOA notice text and write the appeal: \n\n${textContent}` });
    } else if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      userContent.push({ type: "text", text: "Please read this image of an HOA warning notice, identify the citation details, and formulate a formal appeal letter." });
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64Data}`
        }
      });
    } else {
      return res.status(400).json({ error: "Missing image or textContent" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert consumer advocate and attorney specializing in HOA disputes. Analyze the provided HOA violation letter.
Generate a formal, legally structured, and highly professional Dispute & Appeal Letter from the homeowner.
The letter must:
- Address the HOA Board of Directors / ACC Committee.
- State a clear date (use current date).
- Request a formal hearing before the board.
- Refer to state statutes (e.g. if in Texas, cite Texas Property Code § 209.006 which mandates a 30-day notice to cure before fines are assessed).
- Provide reasonable justifications (e.g., temporary placement, error in measurement, weather delays, or request for an extension of time).
- Sound polite, firm, and legally savvy.

Return the result as clean HTML content that can be placed inside an email or printed. Do not include markdown blocks like \`\`\`html. Include tags like <p>, <strong>, and <br/>.`
        },
        {
          role: "user",
          content: userContent
        }
      ]
    });

    res.json({
      letterHtml: response.choices[0].message.content
    });
  } catch (error) {
    console.error("OpenAI Appeal Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to answer HOA bylaw queries using OpenAI GPT-4o
app.post('/ccr-decode', async (req, res) => {
  const { question } = req.body;

  if (!isOpenAIConfigured) {
    return res.status(200).json({
      mock: true,
      message: "OpenAI is not configured. Running chatbot in local mockup mode."
    });
  }

  if (!question) {
    return res.status(400).json({ error: "Missing question" });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are the Shady Oaks Bylaws Decoder AI, a helpful assistant that answers resident questions about neighborhood covenants, conditions, and restrictions (CC&Rs).
Guidelines for Shady Oaks neighborhood:
- Exterior paint changes require Architectural Control Committee (ACC) approval. Sage green door (#ACC-39) is okay. Fences must be natural wood.
- Trash/recycle receptacles can go to the curb no earlier than Tuesday 6 PM, and must be put away by Wednesday 8 PM. Fines: $25/day.
- Recreational vehicles (RVs), boats, trailers can only park on driveways for up to 48 hours. After that, they are towed.
- Raising livestock, poultry, or chickens is strictly prohibited. Standard pets are allowed (dogs, cats, indoor birds).
- Lawn height must be mowed and maintained under 4.0 inches.

If the user's question relates to these bylaws, reference them specifically and cite sections (e.g. Article VI Section 3.2, Rule 4.2). If they ask general questions, explain how typical HOAs behave but refer back to Shady Oaks. Explain things simply, politely, and without legalese. Use bold text for key terms like **approval** or **tow** or specific hours.`
        },
        {
          role: "user",
          content: question
        }
      ]
    });

    res.json({
      answer: response.choices[0].message.content
    });
  } catch (error) {
    console.error("OpenAI Chatbot Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`HOA Guard Payment Gateway Server listening on port ${PORT}`);
});
