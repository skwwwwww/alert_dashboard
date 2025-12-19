import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import type { RuleTask, AlertRule } from '../types/task';


// Backend Task Model matches this shape
interface BackendTask {
    id: number;
    created_at: string;
    updated_at: string;
    rule_name: string;
    rule_content: string; // JSON string
    type: 'ADD' | 'EDIT' | 'DELETE';
    status: 'submitted' | 'processing' | 'waiting_for_review' | 'merged' | 'rejected';
    pr_link: string;
    component: string;
    owner: string;
    description: string;
    diff: string;
}

class TaskService {
    async getTasks(component: string): Promise<RuleTask[]> {
        const response = await axios.get<BackendTask[]>(`${API_BASE_URL}/tasks`, {
            params: { component }
        });

        return response.data.map(this.mapToFrontendTask);
    }

    async createTask(
        rule: AlertRule,
        type: 'ADD' | 'EDIT' | 'DELETE',
        component: string,
        description: string
    ): Promise<RuleTask> {
        const payload = {
            rule_name: rule.alert,
            rule_content: JSON.stringify(rule),
            type,
            component,
            owner: 'nolouch', // Hardcoded for now
            description
        };

        const response = await axios.post<BackendTask>(`${API_BASE_URL}/tasks`, payload);
        return this.mapToFrontendTask(response.data);
    }

    private mapToFrontendTask(backendTask: BackendTask): RuleTask {
        return {
            id: backendTask.id.toString(),
            rule: JSON.parse(backendTask.rule_content) as AlertRule,
            type: backendTask.type,
            status: backendTask.status,
            created_at: backendTask.created_at,
            updated_at: backendTask.updated_at,
            pr_link: backendTask.pr_link,
            component: backendTask.component,
            owner: backendTask.owner,
            description: backendTask.description,
            diff: backendTask.diff
        };
    }
}

export const taskService = new TaskService();
