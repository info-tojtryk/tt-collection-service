const express = require("express");

const app = express();
app.use(express.json());

// Fra Render env vars
const ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN; // fx "tojtryk.dk"
const API_VERSION = "2024-01";

app.get("/", (req, res) => {
  res.send("TT collection service is running ✅");
});

app.post("/add-to-collection", async (req, res) => {
  const { product_id, customer_id } = req.body;

  if (!product_id || !customer_id) {
    return res.status(400).json({ success: false, error: "Missing product_id or customer_id" });
  }

  try {
    // 1) Hent kundens metafields
    const metafieldsRes = await fetch(
      `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/customers/${customer_id}/metafields.json`,
      {
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    const metafieldsJson = await metafieldsRes.json();

    let collectionIdMeta = metafieldsJson.metafields?.find(
      (mf) => mf.namespace === "custom" && mf.key === "collection_id"
    );

    let collectionId;

    // 2) Opret kollektion hvis kunden ikke har en endnu
    if (!collectionIdMeta) {
      const createColRes = await fetch(
        `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/custom_collections.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ADMIN_API_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            custom_collection: {
              title: `Kundeshop #${customer_id}`,
            },
          }),
        }
      );

      const createColJson = await createColRes.json();

      if (!createColRes.ok) {
        console.error("Create collection error:", createColJson);
        return res.json({ success: false, error: "Kunne ikke oprette kollektion" });
      }

      collectionId = createColJson.custom_collection.id;

      // Gem som metafield på kunden
      await fetch(`https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/metafields.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          metafield: {
            namespace: "custom",
            key: "collection_id",
            value: String(collectionId),
            type: "number_integer",
            owner_resource: "customer",
            owner_id: customer_id,
          },
        }),
      });
    } else {
      collectionId = collectionIdMeta.value;
    }

    // 3) Tilføj produkt til kollektionen
    const addProductRes = await fetch(
      `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/collects.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": ADMIN_API_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          collect: {
            collection_id: collectionId,
            product_id: product_id,
          },
        }),
      }
    );

    const addProductJson = await addProductRes.json();

    if (!addProductRes.ok) {
      console.error("Add product error:", addProductJson);
      return res.json({ success: false, error: "Kunne ikke tilføje produkt til kollektion" });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Server error:", err);
    return res.json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("TT collection service listening on port " + PORT);
});
