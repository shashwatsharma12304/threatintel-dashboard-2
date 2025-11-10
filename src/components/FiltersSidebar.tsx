import { Search, X, Save } from 'lucide-react';
import { FilterState, SeverityLevel, StatusType } from '@/types/threat';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FiltersSidebarProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableAssets: string[];
  availableSources: string[];
}

const FiltersSidebar = ({ filters, onFiltersChange }: FiltersSidebarProps) => {
  const severityLevels: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];
  const statusTypes: StatusType[] = ['new', 'active', 'mitigated'];
  
  // Helper to capitalize for display
  const capitalizeFirst = (s: string): string => {
    if (!s) return s;
    return s[0].toUpperCase() + s.slice(1).toLowerCase();
  };
  const timeRanges = [
    { value: 'last24h' as const, label: 'Last 24h' },
    { value: 'last7d' as const, label: 'Last 7 days' },
    { value: 'last30d' as const, label: 'Last 30 days' },
  ];

  const toggleFilter = <K extends keyof FilterState>(key: K, value: FilterState[K] extends (infer U)[] ? U : never) => {
    const currentValues = filters[key] as any[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    onFiltersChange({ ...filters, [key]: newValues });
  };

  const clearAll = () => {
    onFiltersChange({
      search: '',
      severity: [],
      assets: [],
      sources: [],
      statuses: [],
      tags: [],
      timeRange: 'last30d',
    });
  };

  return (
    <div className="bg-card h-full flex flex-col border-r border-border">
      <div className="p-4 flex items-center justify-between border-b border-border">
        <h2 className="text-lg font-semibold">Filters</h2>
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Search */}
          <div>
            <label className="text-sm font-medium mb-2 block">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, asset, CVE..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                className="pl-9 bg-background"
              />
            </div>
          </div>

          <Separator />

          {/* Severity */}
          <div>
            <label className="text-sm font-medium mb-2 block">Severity</label>
            <div className="flex flex-wrap gap-2">
              {severityLevels.map((sev) => (
                <Button
                  key={sev}
                  variant={filters.severity.includes(sev) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFilter('severity', sev)}
                  className="rounded-full"
                >
                  {capitalizeFirst(sev)}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Status */}
          <div>
            <label className="text-sm font-medium mb-2 block">Status</label>
            <div className="flex flex-wrap gap-2">
              {statusTypes.map((status) => (
                <Button
                  key={status}
                  variant={filters.statuses.includes(status) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleFilter('statuses', status)}
                >
                  {capitalizeFirst(status)}
                </Button>
              ))}
            </div>
          </div>
          
          <Separator />

          {/* Time Range */}
          <div>
            <label className="text-sm font-medium mb-2 block">Time Range</label>
            <div className="flex flex-col gap-2">
              {timeRanges.map((range) => (
                <Button
                  key={range.value}
                  variant={filters.timeRange === range.value ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => onFiltersChange({ ...filters, timeRange: range.value })}
                  className="w-full justify-start"
                >
                  {range.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border">
        <Button variant="outline" className="w-full">
          <Save className="h-4 w-4 mr-2" />
          Save View
        </Button>
      </div>
    </div>
  );
};

export default FiltersSidebar;
