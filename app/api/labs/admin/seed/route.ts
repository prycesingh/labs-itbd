import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/DB/drizzle";
import {
  labsArticles as articles,
  labsCertRoadmapEntries as certRoadmapEntries,
  labsCloudComparisons as cloudComparisons,
  labsGlossaryTerms as glossaryTerms,
  labsGotchas as gotchas,
  labsKqlPlaygroundQueries as kqlPlaygroundQueries,
  labsProductionChecklistItems as productionChecklistItems,
  labsQuizCerts as quizCerts,
  labsQuizQuestions as quizQuestions,
  labsServicesCatalog as servicesCatalog,
  labsTroubleshootFlowchartSteps as troubleshootFlowchartSteps,
} from "@/DB/labsSchema";
import { requireApiUser } from "@/lib/labs/auth";
import { ARTICLES_SEED } from "@/lib/labs/seedData/articlesData";
import { CERT_ROADMAP_SEED } from "@/lib/labs/seedData/certRoadmapData";
import { CLOUD_COMPARISON_SEED } from "@/lib/labs/seedData/cloudComparisonData";
import { GLOSSARY_SEED } from "@/lib/labs/seedData/glossaryData";
import { GOTCHAS_SEED } from "@/lib/labs/seedData/gotchasData";
import { KQL_PLAYGROUND_QUERIES_SEED } from "@/lib/labs/seedData/kqlPlaygroundData";
import { PRODUCTION_CHECKLIST_ITEMS_SEED } from "@/lib/labs/seedData/productionChecklistsData";
import { QUIZ_SEED } from "@/lib/labs/seedData/quizData";
import { SERVICES_CATALOG_SEED } from "@/lib/labs/seedData/servicesCatalogData";
import { TROUBLESHOOT_FLOWCHART_STEPS_SEED } from "@/lib/labs/seedData/troubleshootFlowchartsData";

/**
 * One-time (re-runnable) content import for the Labs module's reference
 * content, ported from the standalone itbd-lab static site. Upserts by
 * natural key (glossary term / quiz cert code / etc.) so it's safe to call
 * again after editing the seed data modules.
 */
export async function POST() {
  const { response } = await requireApiUser(["contentAdmin"]);

  if (response) return response;

  let glossaryInserted = 0;
  let glossarySkipped = 0;

  for (const entry of GLOSSARY_SEED) {
    const [existing] = await db
      .select({ id: glossaryTerms.id })
      .from(glossaryTerms)
      .where(eq(glossaryTerms.term, entry.term))
      .limit(1);

    if (existing) {
      glossarySkipped++;
      continue;
    }

    await db.insert(glossaryTerms).values({
      id: randomUUID(),
      term: entry.term,
      category: entry.category,
      definition: entry.definition,
      example: entry.example ?? null,
    });
    glossaryInserted++;
  }

  let certsInserted = 0;
  let questionsInserted = 0;

  for (const [certIndex, cert] of QUIZ_SEED.entries()) {
    let [existingCert] = await db
      .select({ id: quizCerts.id })
      .from(quizCerts)
      .where(eq(quizCerts.code, cert.code))
      .limit(1);

    let certId = existingCert?.id;

    if (!certId) {
      certId = randomUUID();
      await db.insert(quizCerts).values({
        id: certId,
        code: cert.code,
        name: cert.name,
        sortOrder: certIndex,
      });
      certsInserted++;
    }

    const existingQuestions = await db
      .select({ id: quizQuestions.id })
      .from(quizQuestions)
      .where(eq(quizQuestions.certId, certId))
      .limit(1);

    if (existingQuestions.length > 0) continue;

    for (const [questionIndex, q] of cert.questions.entries()) {
      await db.insert(quizQuestions).values({
        id: randomUUID(),
        certId,
        question: q.question,
        options: q.options,
        correctIndexes: q.correctIndexes,
        explanation: q.explanation,
        sortOrder: questionIndex,
      });
      questionsInserted++;
    }
  }

  // ── Services catalog (dedup by name) ──
  let servicesCatalogInserted = 0;
  let servicesCatalogSkipped = 0;

  for (const [index, entry] of SERVICES_CATALOG_SEED.entries()) {
    const [existing] = await db
      .select({ id: servicesCatalog.id })
      .from(servicesCatalog)
      .where(eq(servicesCatalog.name, entry.name))
      .limit(1);

    if (existing) {
      servicesCatalogSkipped++;
      continue;
    }

    await db.insert(servicesCatalog).values({
      id: randomUUID(),
      category: entry.cat,
      name: entry.name,
      icon: entry.icon || null,
      description: entry.desc,
      whenToUse: entry.when || null,
      alternative: entry.alt || null,
      pricing: entry.price || null,
      sortOrder: index,
    });
    servicesCatalogInserted++;
  }

  // ── Cloud comparison (dedup by label) ──
  let cloudComparisonInserted = 0;
  let cloudComparisonSkipped = 0;

  for (const [index, entry] of CLOUD_COMPARISON_SEED.entries()) {
    const [existing] = await db
      .select({ id: cloudComparisons.id })
      .from(cloudComparisons)
      .where(eq(cloudComparisons.label, entry.label))
      .limit(1);

    if (existing) {
      cloudComparisonSkipped++;
      continue;
    }

    await db.insert(cloudComparisons).values({
      id: randomUUID(),
      category: entry.category,
      label: entry.label,
      azureEquivalent: entry.azure || null,
      awsEquivalent: entry.aws || null,
      gcpEquivalent: entry.gcp || null,
      note: entry.note || null,
      sortOrder: index,
    });
    cloudComparisonInserted++;
  }

  // ── Gotchas (dedup by title) ──
  let gotchasInserted = 0;
  let gotchasSkipped = 0;

  for (const [index, entry] of GOTCHAS_SEED.entries()) {
    const [existing] = await db
      .select({ id: gotchas.id })
      .from(gotchas)
      .where(eq(gotchas.title, entry.title))
      .limit(1);

    if (existing) {
      gotchasSkipped++;
      continue;
    }

    await db.insert(gotchas).values({
      id: randomUUID(),
      category: entry.cat,
      title: entry.title,
      symptom: entry.symptom,
      cause: entry.cause,
      fix: entry.fix,
      sortOrder: index,
    });
    gotchasInserted++;
  }

  // ── Cert roadmap (dedup by certCode) ──
  let certRoadmapInserted = 0;
  let certRoadmapSkipped = 0;

  for (const [index, entry] of CERT_ROADMAP_SEED.entries()) {
    const [existing] = await db
      .select({ id: certRoadmapEntries.id })
      .from(certRoadmapEntries)
      .where(eq(certRoadmapEntries.certCode, entry.code))
      .limit(1);

    if (existing) {
      certRoadmapSkipped++;
      continue;
    }

    await db.insert(certRoadmapEntries).values({
      id: randomUUID(),
      certCode: entry.code,
      certName: entry.name,
      level: entry.level,
      track: entry.track,
      description: entry.desc,
      studyTime: entry.time || null,
      examFormat: entry.questions || null,
      passingScore: entry.passing || null,
      pricing: entry.price || null,
      relatedSims: entry.sims || null,
      skills: entry.skills,
      tips: entry.tips || null,
      relatedSimulatorKeys: entry.relatedSimulatorKeys ?? [],
      sortOrder: index,
    });
    certRoadmapInserted++;
  }

  // ── Production checklists (dedup per checklistName — all-or-nothing) ──
  let productionChecklistsInserted = 0;
  let productionChecklistsSkipped = 0;

  for (const checklistName of new Set(PRODUCTION_CHECKLIST_ITEMS_SEED.map((i) => i.checklistName))) {
    const [existing] = await db
      .select({ id: productionChecklistItems.id })
      .from(productionChecklistItems)
      .where(eq(productionChecklistItems.checklistName, checklistName))
      .limit(1);

    const itemsForChecklist = PRODUCTION_CHECKLIST_ITEMS_SEED.filter((i) => i.checklistName === checklistName);

    if (existing) {
      productionChecklistsSkipped += itemsForChecklist.length;
      continue;
    }

    for (const item of itemsForChecklist) {
      await db.insert(productionChecklistItems).values({
        id: randomUUID(),
        checklistName: item.checklistName,
        category: item.category,
        item: item.item,
        sortOrder: item.sortOrder,
      });
      productionChecklistsInserted++;
    }
  }

  // ── KQL playground (dedup by title) ──
  let kqlPlaygroundInserted = 0;
  let kqlPlaygroundSkipped = 0;

  for (const [index, entry] of KQL_PLAYGROUND_QUERIES_SEED.entries()) {
    const [existing] = await db
      .select({ id: kqlPlaygroundQueries.id })
      .from(kqlPlaygroundQueries)
      .where(eq(kqlPlaygroundQueries.title, entry.title))
      .limit(1);

    if (existing) {
      kqlPlaygroundSkipped++;
      continue;
    }

    await db.insert(kqlPlaygroundQueries).values({
      id: randomUUID(),
      level: entry.level,
      title: entry.title,
      description: entry.desc || null,
      kqlQuery: entry.kql,
      explanation: entry.explain || null,
      sortOrder: index,
    });
    kqlPlaygroundInserted++;
  }

  // ── Troubleshoot flowcharts (dedup per flowName — all-or-nothing) ──
  let troubleshootFlowchartsInserted = 0;
  let troubleshootFlowchartsSkipped = 0;

  for (const flowName of new Set(TROUBLESHOOT_FLOWCHART_STEPS_SEED.map((s) => s.flowName))) {
    const [existing] = await db
      .select({ id: troubleshootFlowchartSteps.id })
      .from(troubleshootFlowchartSteps)
      .where(eq(troubleshootFlowchartSteps.flowName, flowName))
      .limit(1);

    const stepsForFlow = TROUBLESHOOT_FLOWCHART_STEPS_SEED.filter((s) => s.flowName === flowName);

    if (existing) {
      troubleshootFlowchartsSkipped += stepsForFlow.length;
      continue;
    }

    for (const step of stepsForFlow) {
      await db.insert(troubleshootFlowchartSteps).values({
        id: randomUUID(),
        flowName: step.flowName,
        stepIndex: step.stepIndex,
        stepType: step.stepType,
        title: step.title,
        description: step.description,
      });
      troubleshootFlowchartsInserted++;
    }
  }

  // ── Articles (dedup by slug) ──
  let articlesInserted = 0;
  let articlesSkipped = 0;

  for (const entry of ARTICLES_SEED) {
    const [existing] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.slug, entry.slug))
      .limit(1);

    if (existing) {
      articlesSkipped++;
      continue;
    }

    await db.insert(articles).values({
      id: randomUUID(),
      slug: entry.slug,
      title: entry.title,
      category: entry.category,
      sourcePage: entry.sourcePage,
      summary: entry.summary || null,
      bodyMarkdown: entry.bodyMarkdown,
      sortOrder: entry.sortOrder,
    });
    articlesInserted++;
  }

  return NextResponse.json({
    glossary: { inserted: glossaryInserted, skipped: glossarySkipped },
    quizzes: { certsInserted, questionsInserted },
    servicesCatalog: { inserted: servicesCatalogInserted, skipped: servicesCatalogSkipped },
    cloudComparison: { inserted: cloudComparisonInserted, skipped: cloudComparisonSkipped },
    gotchas: { inserted: gotchasInserted, skipped: gotchasSkipped },
    certRoadmap: { inserted: certRoadmapInserted, skipped: certRoadmapSkipped },
    productionChecklists: { inserted: productionChecklistsInserted, skipped: productionChecklistsSkipped },
    kqlPlayground: { inserted: kqlPlaygroundInserted, skipped: kqlPlaygroundSkipped },
    troubleshootFlowcharts: { inserted: troubleshootFlowchartsInserted, skipped: troubleshootFlowchartsSkipped },
    articles: { inserted: articlesInserted, skipped: articlesSkipped },
  });
}
