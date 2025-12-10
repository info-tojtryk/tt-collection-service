const express = require("express");

const app = express();
app.use(express.json());

// Fra Render env vars
const ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const SHOP_DOMAIN = process.env.SHOPIFY_SHOP_DOMAIN; // fx "gn2axf-h1.myshopify.com"
const API_VERSION = "2024-01";

// Root – healthcheck
app.get("/", (req, res) => {
  res.send("TT collection service is running ✅");
});

/**
 * POST /add-to-collection
 * Forventet body fra din produkt-side:
 * {
 *   customerId: "...",
 *   productId: "...",
 *   collectionId: "...",   // kommer fra customer.metafields.b2b.personal_collection_id
 *   variantId: "...",
 *   source: "product-page",
 *   shop: "gn2axf-h1.myshopify.com"
 * }
 */
app.post("/add-to-collection", async (req, res) => {
  // Understøt både camelCase og snake_case for bagudkompatibilitet
  const productId = req.body.productId || req.body.product_id || null;
  const customerId = req.body.customerId || req.body.customer_id || null;
  const collectionIdFromBody =
    req.body.collectionId || req.body.collection_id || null;
  const variantId = req.body.variantId || req.body.variant_id || null;
  const source = req.body.source || "unknown";
  const shopFromBody = req.body.shop || SHOP_DOMAIN;

  // Produkt er absolut minimumskrav, uden det kan vi ikke lave collect
  if (!productId) {
    return res.status(400).json({
      success: false,
      error: "Missing productId / product_id",
    });
  }

  // Vi vil meget gerne have customerId også – enten til fallback eller logging
  if (!customerId && !collectionIdFromBody) {
    return res.status(400).json({
      success: false,
      error: "Missing customerId (for metafield lookup) and collectionId",
    });
  }

  console.log("----- Add to collection request -----");
  console.log("Shop:     ", shopFromBody);
  console.log("Source:   ", source);
  console.log("Customer: ", customerId || "N/A");
  console.log("Product:  ", productId);
  console.log("Variant:  ", variantId || "N/A");
  console.log("Coll (in):", collectionIdFromBody || "N/A");
  console.log("-------------------------------------");

  let collectionId = collectionIdFromBody;

  try {
    // 1) Hvis vi IKKE fik collectionId med fra frontenden,
    //    forsøger vi at slå det op på kunden via metafields
    if (!collectionId) {
      const metafieldsRes = await fetch(
        `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/customers/${customerId}/metafields.json`,
        {
          headers: {
            "X-Shopify-Access-Token": ADMIN_API_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      const metafieldsJson = await metafieldsRes.json();

      if (!metafieldsRes.ok) {
        console.error("Metafields fetch error:", metafieldsJson);
        return res.json({
          success: false,
          error: "Kunne ikke hente kundens metafields",
        });
      }

      // Forsøg først at finde din B2B-metafield:
      // namespace: "b2b", key: "personal_collection_id"
      let collectionIdMeta = metafieldsJson.metafields?.find(
        (mf) =>
          (mf.namespace === "b2b" &&
            mf.key === "personal_collection_id") ||
          (mf.namespace === "custom" && mf.key === "collection_id")
      );

      // Hvis vi fandt noget – brug det
      if (collectionIdMeta) {
        collectionId = collectionIdMeta.value;
        console.log("Found collectionId in metafield:", collectionId);
      } else {
        // 2) Hvis kunden slet ikke har en kollektion endnu → opret én
        console.log("No collection metafield found – creating new collection…");

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
                title: `Kundeshop #${customerId}`,
              },
            }),
          }
        );

        const createColJson = await createColRes.json();

        if (!createColRes.ok) {
          console.error("Create collection error:", createColJson);
          return res.json({
            success: false,
            error: "Kunne ikke oprette kollektion",
          });
        }

        collectionId = createColJson.custom_collection.id;

        console.log("Created new collection with ID:", collectionId);

        // Gem som metafield på kunden – brug B2B-navngivning,
        // så det matcher dit Liquid:
        // customer.metafields.b2b.personal_collection_id
        const metaCreateRes = await fetch(
          `https://${SHOP_DOMAIN}/admin/api/${API_VERSION}/metafields.json`,
          {
            method: "POST",
            headers: {
              "X-Shopify-Access-Token": ADMIN_API_TOKEN,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              metafield: {
                namespace: "b2b",
                key: "personal_collection_id",
                value: String(collectionId),
                type: "number_integer",
                owner_resource: "customer",
                owner_id: customerId,
              },
            }),
          }
        );

        const metaCreateJson = await metaCreateRes.json();

        if (!metaCreateRes.ok) {
          console.error("Create metafield error:", metaCreateJson);
          // Ikke fatal – kollektionen eksisterer,
          // men vi kan ikke gemme ID'et som metafield.
        }
      }
    }

    // Hvis vi stadig ikke har et collectionId her, så giv op
    if (!collectionId) {
      return res.json({
        success: false,
        error: "Ingen collectionId fundet eller oprettet",
      });
    }

    // 3) Tilføj produkt til kollektionen (på produkt-niveau, ikke variant)
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
            product_id: productId,
          },
        }),
      }
    );

    const addProductJson = await addProductRes.json();

    if (!addProductRes.ok) {
      console.error("Add product error:", addProductJson);
      return res.json({
        success: false,
        error: "Kunne ikke tilføje produkt til kollektion",
      });
    }

    console.log(
      `Product ${productId} (variant ${variantId || "N/A"}) added to collection ${collectionId}`
    );

    return res.json({ success: true, message: "Product added to collection", shopify: addProductJson });
  } catch (err) {
    console.error("Server error (add-to-collection):", err);
    return res.json({ success: false, error: err.message });
  }
});


