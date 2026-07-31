import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Search, Layout, Clock, X, Loader2, Sparkles } from "@/icons/lucide-compat";
import { ToolcraftButton as Button } from "@openreel/ui";
import { ToolcraftSelectableCard as SelectableCard } from "@openreel/ui";
import { ToolcraftTextInputControl } from "@openreel/ui";
import { useEngineStore } from "../../../stores/engine-store";
import { useProjectStore } from "../../../stores/project-store";
import { useRouter } from "../../../hooks/use-router";
import type {
  TemplateSummary,
  TemplateCategory,
} from "@openreel/core";
import { TEMPLATE_CATEGORIES } from "@openreel/core";

export const TemplatesTab: React.FC = () => {
  const getTemplateEngine = useEngineStore((s) => s.getTemplateEngine);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | TemplateCategory
  >("all");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const createMotionComposition = useProjectStore(
    (state) => state.createMotionComposition,
  );
  const { navigate } = useRouter();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const engine = await getTemplateEngine();
      await engine.initialize();
      const list = await engine.listTemplates();
      if (!cancelled) {
        setTemplates(list);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [getTemplateEngine]);

  const filteredTemplates = useMemo(() => {
    let result = templates;
    if (selectedCategory !== "all") {
      result = result.filter((t) => t.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    return result;
  }, [templates, selectedCategory, searchQuery]);

  const handleApplyTemplate = useCallback(
    async (templateId: string) => {
      const hasClips =
        useProjectStore.getState().project.timeline.tracks.length > 0;
      if (hasClips) {
        const confirmed = window.confirm(
          "Applying a template will replace your current project. Continue?",
        );
        if (!confirmed) return;
      }

      setApplying(templateId);
      try {
        const engine = await getTemplateEngine();
        const template = await engine.loadTemplate(templateId);
        if (!template) return;

        const result = engine.applyTemplate(template, {});
        useProjectStore.setState(() => ({
          project: { ...result.project, modifiedAt: Date.now() },
        }));
      } finally {
        setApplying(null);
      }
    },
    [getTemplateEngine],
  );

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, "0")}` : `${secs}s`;
  };

  if (loading) {
    return (
      <div className="px-5 py-4 space-y-4 flex-1 h-full bg-background-secondary overflow-hidden">
        <div className="h-9 bg-background-tertiary rounded-lg animate-pulse" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-6 w-16 bg-background-tertiary rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          {[1, 2, 4, 5].map((i) => (
            <div key={i} className="h-36 bg-background-tertiary rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-3.5 flex-1 min-h-0 h-full overflow-y-auto bg-background-secondary">
      {/* Search Input Bar */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <ToolcraftTextInputControl
          label="Search templates"
          isLabelHidden
          placeholder="Search templates..."
          value={searchQuery}
          onChange={setSearchQuery}
          className="w-full pl-9 pr-8 py-2 text-xs bg-background-tertiary border border-border/80 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex gap-1.5 flex-wrap">
        <SelectableCard
          label="All"
          isSelected={selectedCategory === "all"}
          onChange={() => setSelectedCategory("all")}
          onClick={() => setSelectedCategory("all")}
          padding={1}
          variant={selectedCategory === "all" ? "green" : "muted"}
          className={`px-3 py-1 text-[10px] font-medium rounded-full border transition-all cursor-pointer ${
            selectedCategory === "all"
              ? "bg-primary/15 border-primary text-primary shadow-xs"
              : "bg-background-tertiary/60 border-border/60 text-text-muted hover:border-text-muted/40 hover:text-text-primary"
          }`}
        >
          All
        </SelectableCard>
        {TEMPLATE_CATEGORIES.slice(0, 6).map((cat) => (
          <SelectableCard
            key={cat.id}
            label={cat.name}
            isSelected={selectedCategory === cat.id}
            onChange={() => setSelectedCategory(cat.id)}
            onClick={() => setSelectedCategory(cat.id)}
            padding={1}
            variant={selectedCategory === cat.id ? "green" : "muted"}
            className={`px-3 py-1 text-[10px] font-medium rounded-full border transition-all cursor-pointer ${
              selectedCategory === cat.id
                ? "bg-primary/15 border-primary text-primary shadow-xs"
                : "bg-background-tertiary/60 border-border/60 text-text-muted hover:border-text-muted/40 hover:text-text-primary"
            }`}
          >
            {cat.name}
          </SelectableCard>
        ))}
      </div>

      {/* Hero Creator Card */}
      <button
        type="button"
        aria-label="Start a Motion Creator template"
        className="group relative flex min-h-[72px] w-full items-center gap-3 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-3.5 text-left transition-all hover:border-primary/50 hover:bg-primary/15 hover:shadow-sm active:scale-[0.99]"
        onClick={async () => {
          const composition = await createMotionComposition(
            "Motion Template Scene",
            "motion-ad-card",
          );
          if (composition) {
            navigate("motion", { compositionId: composition.id });
          }
        }}
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-white shadow-xs group-hover:scale-105 transition-transform">
          <Sparkles size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-text-primary group-hover:text-primary transition-colors">
            Start a Motion Creator template
          </span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-text-muted line-clamp-2">
            Ads, app UI demos, lower thirds, social hooks, logo reveals, and end screens.
          </span>
        </span>
      </button>

      {/* Grid Templates */}
      {filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border/80">
          <Layout size={28} className="text-text-muted/40 mb-2" />
          <p className="text-xs font-medium text-text-primary">No templates found</p>
          <p className="text-[10px] text-text-muted mt-0.5">Try adjusting your search or category filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pt-1">
          {filteredTemplates.map((template) => {
            const isBeingApplied = applying === template.id;

            return (
              <div
                key={template.id}
                className="group relative flex flex-col p-2 bg-background-tertiary/70 border border-border/80 rounded-xl hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden"
              >
                {/* Thumbnail Header */}
                <div className="relative w-full aspect-video bg-background-secondary rounded-lg overflow-hidden flex items-center justify-center border border-border/40">
                  {template.thumbnailUrl ? (
                    <img
                      src={template.thumbnailUrl}
                      alt={template.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-text-muted/50 group-hover:text-primary/70 transition-colors">
                      <Layout size={22} />
                    </div>
                  )}

                  {/* Hover Overlay with Action Button */}
                  <div className="absolute inset-0 bg-background-primary/60 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px] flex items-center justify-center p-2">
                    <Button
                      label="Use Template"
                      variant="primary"
                      onClick={() => handleApplyTemplate(template.id)}
                      isDisabled={applying !== null}
                      className="w-full py-1 text-[10px] font-medium shadow-sm transform translate-y-1 group-hover:translate-y-0 transition-all duration-200"
                    >
                      Use Template
                    </Button>
                  </div>
                </div>

                {/* Meta details */}
                <div className="mt-2.5 px-0.5 flex flex-col gap-1 min-w-0">
                  <span className="text-[11px] font-semibold text-text-primary truncate" title={template.name}>
                    {template.name}
                  </span>

                  <div className="flex items-center justify-between gap-1 text-[9px]">
                    <span className="px-1.5 py-0.5 rounded bg-background-secondary text-text-muted capitalize font-medium truncate max-w-[65%]">
                      {template.category.replace("-", " ")}
                    </span>
                    <span className="flex items-center gap-0.5 text-text-muted/80 shrink-0 font-mono">
                      <Clock size={9} />
                      {formatDuration(template.duration)}
                    </span>
                  </div>
                </div>

                {/* Applying Loader Overlay */}
                {isBeingApplied && (
                  <div className="absolute inset-0 z-10 bg-background-primary/85 backdrop-blur-xs rounded-xl flex flex-col items-center justify-center gap-1.5 animate-fadeIn">
                    <Loader2 size={18} className="text-primary animate-spin" />
                    <span className="text-[10px] font-medium text-primary">Applying...</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};