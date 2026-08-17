import {
  EVALUATION_DIMENSION_LABELS,
  EVALUATION_DIMENSION_ORDER,
  type DimensionScoreMap,
} from "@/lib/interview/evaluationMetrics";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import fs from "node:fs";
import path from "node:path";

// Embedded as a base64 data URI (read once at module load) rather than passed
// as a raw filesystem path — @react-pdf/renderer's image resolver tries a
// fetch()-based path before falling back to fs reads, which can throw fatally
// in server environments without outbound network access and abort the whole
// PDF render.
const LOGO_DATA_URI = (() => {
  try {
    const logoPath = path.join(process.cwd(), "public", "itbd_logo_img.png");
    return `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  } catch (error) {
    console.warn("Failed to load PDF logo asset", error);
    return null;
  }
})();

// ITBD brand tokens (see CLAUDE.md — closed palette, no ad-hoc hex outside this set).
const ITBD_BLUE = "#00ADDA";
const ITBD_BLACK = "#000000";
const ITBD_WHITE = "#FFFFFF";
const ITBD_LIGHT_GRAY = "#BFBFBF";
const ITBD_NEUTRAL_GRAY = "#252525";

export type ResultsPdfAnswer = {
  questionIndex: number;
  questionText: string;
  aiScore: number | null;
  finalScore: number | null;
  aiDimensions: DimensionScoreMap;
  finalDimensions: DimensionScoreMap;
  transcript: string | null;
};

export type ResultsPdfData = {
  candidateName: string;
  moduleName: string;
  completedAt: string;
  aiScore: number | null;
  finalScore: number | null;
  aiDimensions: DimensionScoreMap;
  finalDimensions: DimensionScoreMap;
  strengths: string[];
  improvementAreas: string[];
  summary: string;
  answers: ResultsPdfAnswer[];
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: ITBD_BLACK,
    color: ITBD_WHITE,
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: `1px solid ${ITBD_LIGHT_GRAY}`,
  },
  logo: {
    width: 120,
    objectFit: "contain",
  },
  headerMeta: {
    textAlign: "right",
  },
  title: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    color: ITBD_WHITE,
  },
  subtitle: {
    fontSize: 10,
    color: ITBD_LIGHT_GRAY,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: ITBD_NEUTRAL_GRAY,
    borderRadius: 6,
    padding: 14,
  },
  scoreLabel: {
    fontSize: 8,
    color: ITBD_LIGHT_GRAY,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  scoreValue: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: ITBD_BLUE,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: ITBD_WHITE,
    marginBottom: 8,
    marginTop: 16,
  },
  card: {
    backgroundColor: ITBD_NEUTRAL_GRAY,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: ITBD_LIGHT_GRAY,
  },
  bullet: {
    fontSize: 9.5,
    lineHeight: 1.5,
    color: ITBD_LIGHT_GRAY,
    marginBottom: 4,
  },
  dimensionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dimensionCell: {
    width: "48%",
    backgroundColor: ITBD_NEUTRAL_GRAY,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  dimensionLabel: {
    fontSize: 8,
    color: ITBD_LIGHT_GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  dimensionScores: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dimensionScoreAi: {
    fontSize: 9.5,
    color: ITBD_BLUE,
  },
  dimensionScoreFinal: {
    fontSize: 9.5,
    color: ITBD_WHITE,
  },
  answerCard: {
    backgroundColor: ITBD_NEUTRAL_GRAY,
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  answerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  answerQuestion: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: ITBD_WHITE,
    maxWidth: "75%",
  },
  answerScore: {
    fontSize: 9.5,
    color: ITBD_BLUE,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: ITBD_LIGHT_GRAY,
    borderTop: `1px solid ${ITBD_NEUTRAL_GRAY}`,
    paddingTop: 8,
  },
});

function formatScore(value: number | null): string {
  return typeof value === "number" ? `${value.toFixed(0)} / 100` : "Pending";
}

function DimensionGrid({
  aiDimensions,
  finalDimensions,
}: {
  aiDimensions: DimensionScoreMap;
  finalDimensions: DimensionScoreMap;
}) {
  return (
    <View style={styles.dimensionGrid}>
      {EVALUATION_DIMENSION_ORDER.map((key) => (
        <View key={key} style={styles.dimensionCell}>
          <Text style={styles.dimensionLabel}>
            {EVALUATION_DIMENSION_LABELS[key]}
          </Text>
          <View style={styles.dimensionScores}>
            <Text style={styles.dimensionScoreAi}>
              AI {aiDimensions[key]?.score?.toFixed(1) ?? "-"}
            </Text>
            <Text style={styles.dimensionScoreFinal}>
              Final{" "}
              {(finalDimensions[key]?.score ?? aiDimensions[key]?.score)?.toFixed(
                1,
              ) ?? "-"}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function ResultsPdfDocument({ data }: { data: ResultsPdfData }) {
  return (
    <Document
      title={`${data.moduleName} — Interview Results`}
      author="IT By Design"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {LOGO_DATA_URI && <Image src={LOGO_DATA_URI} style={styles.logo} />}
          <View style={styles.headerMeta}>
            <Text style={styles.title}>Interview Results</Text>
            <Text style={styles.subtitle}>{data.candidateName}</Text>
            <Text style={styles.subtitle}>{data.moduleName}</Text>
            <Text style={styles.subtitle}>{data.completedAt}</Text>
          </View>
        </View>

        <View style={styles.scoreRow}>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>AI Score</Text>
            <Text style={styles.scoreValue}>{formatScore(data.aiScore)}</Text>
          </View>
          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>Final Score</Text>
            <Text style={styles.scoreValue}>
              {formatScore(data.finalScore)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.card}>
          <Text style={styles.bodyText}>{data.summary}</Text>
        </View>

        <Text style={styles.sectionTitle}>Strengths</Text>
        <View style={styles.card}>
          {data.strengths.length > 0 ? (
            data.strengths.map((item, index) => (
              <Text key={index} style={styles.bullet}>
                • {item}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyText}>No strengths recorded.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Areas for Improvement</Text>
        <View style={styles.card}>
          {data.improvementAreas.length > 0 ? (
            data.improvementAreas.map((item, index) => (
              <Text key={index} style={styles.bullet}>
                • {item}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyText}>No improvement areas recorded.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Dimension Breakdown</Text>
        <DimensionGrid
          aiDimensions={data.aiDimensions}
          finalDimensions={data.finalDimensions}
        />

        <View style={styles.footer} fixed>
          <Text>IT By Design — Labs ITBD</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Answer Breakdown</Text>
        {data.answers.map((answer) => (
          <View key={answer.questionIndex} style={styles.answerCard} wrap={false}>
            <View style={styles.answerHeader}>
              <Text style={styles.answerQuestion}>
                Q{answer.questionIndex + 1}: {answer.questionText}
              </Text>
              <Text style={styles.answerScore}>
                {formatScore(answer.finalScore ?? answer.aiScore)}
              </Text>
            </View>
            <Text style={styles.bodyText}>
              {answer.transcript?.trim() || "Transcript unavailable."}
            </Text>
          </View>
        ))}

        <View style={styles.footer} fixed>
          <Text>IT By Design — Labs ITBD</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderResultsPdf(data: ResultsPdfData): Promise<Buffer> {
  return renderToBuffer(<ResultsPdfDocument data={data} />);
}
