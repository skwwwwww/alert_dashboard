export interface AlertRule {
    alert: string;
    expr: string;
    for: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
    file_path: string;
    category: string; // 'premium' | 'dedicated' | 'essential'
    rule_type?: string; // 'prometheus' | 'logging'
}

export interface RuleTask {
    id: string;
    rule: AlertRule;
    type: 'ADD' | 'EDIT' | 'DELETE';
    status: 'submitted' | 'processing' | 'waiting_for_review' | 'merged' | 'rejected';
    created_at: string;
    updated_at: string;
    pr_link?: string;
    component: string;
    owner: string; // 'nolouch'
    description?: string; // Change description
    diff?: string; // Unified diff
}
