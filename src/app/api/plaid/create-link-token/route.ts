import { NextResponse } from "next/server";
import { CountryCode, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { getCurrentUserId } from "@/lib/auth";

export async function POST() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Thyme",
      language: "en",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us, CountryCode.Ca],
    });
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error("Error creating link token:", error);
    return NextResponse.json({ error: "Failed to create link token." }, { status: 500 });
  }
}
