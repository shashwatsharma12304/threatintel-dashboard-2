import { useState } from 'react';
import { Search, Ticket, MessageSquare, ShieldAlert, Loader2 } from 'lucide-react';
import { Threat } from '@/types/threat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { executeAction } from '@/lib/api';
import { toast } from 'sonner';

interface ActModalProps {
  threat: Threat | null;
  open: boolean;
  onClose: () => void;
}

const ActModal = ({ threat, open, onClose }: ActModalProps) => {
  const [loading, setLoading] = useState(false);

  if (!threat) return null;

  const actions = [
    {
      id: 'asm',
      label: 'Perform ASM on Pentest app',
      description: 'Run Attack Surface Management assessment',
      icon: Search,
      color: 'primary',
    },
    {
      id: 'jira',
      label: 'Create Jira Ticket',
      description: 'Create ticket in Jira for tracking',
      icon: Ticket,
      color: 'accent',
    },
    {
      id: 'slack',
      label: 'Ping Slack Channel',
      description: 'Notify security team on Slack',
      icon: MessageSquare,
      color: 'success',
    },
    {
      id: 'isolate',
      label: 'Isolate Asset',
      description: 'Quarantine affected system (stub)',
      icon: ShieldAlert,
      color: 'warning',
    },
  ];

  const handleAction = async (actionType: string) => {
    setLoading(true);
    try {
      // Stub handlers for each action type
      switch (actionType) {
        case 'asm':
          // Perform ASM on Pentest app - open URL with autofill
          const asmPrompt = `Perform Attack Surface Management (ASM) assessment for the following threat:

**Threat Details:**
- Name: ${threat.name}
- Asset: ${threat.asset}
- Severity: ${threat.severity}
- Status: ${threat.status}
- Source: ${threat.source}
- First Seen: ${new Date(threat.first_seen).toLocaleDateString('en-GB')}
${threat.description ? `\n**Description:**\n${threat.description}` : ''}
${threat.cves && threat.cves.length > 0 ? `\n**CVEs:**\n${threat.cves.join(', ')}` : ''}
${threat.iocs && threat.iocs.length > 0 ? `\n**IOCs:**\n${threat.iocs.map(ioc => `${ioc.type}: ${ioc.value}`).join('\n')}` : ''}
${threat.recommended_actions && threat.recommended_actions.length > 0 ? `\n**Recommended Actions:**\n${threat.recommended_actions.join('\n- ')}` : ''}

Please perform a comprehensive ASM assessment focusing on:
1. Identifying all attack surfaces related to ${threat.asset}
2. Analyzing potential vulnerabilities and exposure points
3. Assessing the current security posture
4. Providing remediation recommendations`;

          // Copy to clipboard
          await navigator.clipboard.writeText(asmPrompt);
          
          // Open the URL - try with prompt parameter first, then clipboard as fallback
          const baseUrl = 'https://pentest.transilience.cloud/chat?new_thread=new_OCJ';
          // Try encoding the prompt as a URL parameter (some apps support this)
          const urlWithPrompt = `${baseUrl}&prompt=${encodeURIComponent(asmPrompt)}`;
          
          // Open in new window
          window.open(urlWithPrompt, '_blank');
          
          toast.success('Opening ASM assessment...', { 
            description: 'Prompt copied to clipboard. Paste it into the input field if it doesn\'t auto-fill.',
            duration: 5000
          });
          break;
        case 'jira':
          // Stub: Create Jira ticket
          await new Promise(resolve => setTimeout(resolve, 800));
          toast.success('Jira ticket created', { description: `Ticket created for threat: ${threat.name}` });
          break;
        case 'slack':
          // Stub: Ping Slack channel
          await new Promise(resolve => setTimeout(resolve, 800));
          toast.success('Slack notification sent', { description: `Security team notified about ${threat.name}` });
          break;
        case 'isolate':
          // Stub: Isolate asset
          await new Promise(resolve => setTimeout(resolve, 800));
          toast.success('Asset isolation initiated', { description: `Isolating asset: ${threat.asset}` });
          break;
        default:
          const result = await executeAction(threat.id, actionType);
          if (result.ok) {
            toast.success(`Action "${actionType}" executed successfully!`);
          }
      }
      onClose();
    } catch (error) {
      toast.error('Failed to execute action');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Take Action on Threat</DialogTitle>
          <DialogDescription>
            Select an action to respond to: <strong>{threat.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-4">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              className="h-auto py-4 px-4 justify-start text-left hover:bg-secondary/80 transition-colors"
              onClick={() => handleAction(action.id)}
              disabled={loading}
            >
              <div className="flex items-start gap-3 w-full">
                <div className={`p-2 rounded-lg bg-${action.color}/10 text-${action.color}`}>
                  <action.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm mb-1">{action.label}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ActModal;
