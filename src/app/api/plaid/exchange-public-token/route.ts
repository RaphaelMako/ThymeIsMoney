import { NextResponse } from "next/server";
import { CountryCode } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { getCurrentUserId } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    const { public_token } = await req.json();
    if (typeof public_token !== "string") {
      return NextResponse.json({ error: "public_token is required." }, { status: 400 });
    }

    const exchange = await plaidClient.itemPublicTokenExchange({ public_token });
    const { item_id: plaidItemId, access_token: accessToken } = exchange.data;

    const itemInfo = await plaidClient.itemGet({ access_token: accessToken });
    const institutionId = itemInfo.data.item.institution_id ?? null;
    let institutionName: string | null = null;
    if (institutionId) {
      try {
        const inst = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us, CountryCode.Ca],
        });
        institutionName = inst.data.institution.name;
      } catch {
        // institution name is nice-to-have
      }
    }

    const item = await db.plaidItem.upsert({
      where: { plaidItemId },
      update: { accessToken, institutionId, institutionName },
      create: { userId, plaidItemId, accessToken, institutionId, institutionName },
    });

    const accountsResponse = await plaidClient.accountsGet({ access_token: accessToken });
    for (const acct of accountsResponse.data.accounts) {
      await db.bankAccount.upsert({
        where: { plaidAccountId: acct.account_id },
        update: {
          name: acct.name,
          officialName: acct.official_name,
          mask: acct.mask,
          type: acct.type,
          subtype: acct.subtype,
          currentBalance: acct.balances.current,
          availableBalance: acct.balances.available,
          isoCurrencyCode: acct.balances.iso_currency_code,
        },
        create: {
          plaidItemId: item.id,
          plaidAccountId: acct.account_id,
          name: acct.name,
          officialName: acct.official_name,
          mask: acct.mask,
          type: acct.type,
          subtype: acct.subtype,
          currentBalance: acct.balances.current,
          availableBalance: acct.balances.available,
          isoCurrencyCode: acct.balances.iso_currency_code,
        },
      });
    }

    return NextResponse.json({ item_id: item.id });
  } catch (error) {
    console.error("Error exchanging public token:", error);
    return NextResponse.json({ error: "A server error occurred." }, { status: 500 });
  }
}
