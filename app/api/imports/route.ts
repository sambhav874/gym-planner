import { NextResponse } from "next/server";
import { parseWorkbook } from "@/lib/workbook-parser";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Attach an .xlsx workbook or .csv file to review." }, { status: 400 });
    if (!/\.(xlsx|csv)$/i.test(file.name)) return NextResponse.json({ error: "Only .xlsx and .csv files are supported." }, { status: 400 });
    const plan = await parseWorkbook(await file.arrayBuffer(), file.name);
    return NextResponse.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The workbook could not be read.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
