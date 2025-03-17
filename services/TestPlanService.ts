// TestPlanService.ts - Service pour gérer les plans de test
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TelemetryService } from './TelemetryService';

export enum TestTaskStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export type TestTask = {
  id: string;
  title: string;
  description: string;
  feature: string;
  difficulty: 'easy' | 'medium' | 'hard';
  steps: string[];
  status: TestTaskStatus;
  startTime?: number;
  endTime?: number;
  userFeedback?: {
    rating: number; // 1-5
    comments?: string;
    difficultyRating?: number; // 1-5
  };
};

export type TestPlan = {
  id: string;
  title: string;
  description: string;
  disabilityType: 'visual' | 'hearing' | 'mobility' | 'cognitive' | 'multiple';
  tasks: TestTask[];
  startTime?: number;
  endTime?: number;
  completed: boolean;
};

export class TestPlanService {
  private static instance: TestPlanService;
  private telemetryService: TelemetryService;
  private activePlan: TestPlan | null = null;
  private availablePlans: TestPlan[] = [];
  
  private constructor() {
    this.telemetryService = TelemetryService.getInstance();
    this.loadTestPlans();
  }
  
  public static getInstance(): TestPlanService {
    if (!TestPlanService.instance) {
      TestPlanService.instance = new TestPlanService();
    }
    return TestPlanService.instance;
  }
  
  // Charge les plans de test disponibles
  private async loadTestPlans(): Promise<void> {
    try {
      // Dans une vraie application, ces plans pourraient être chargés depuis un serveur
      this.availablePlans = [
        // Plan pour personnes malvoyantes
        {
          id: 'visual_impairment_1',
          title: 'Test des fonctionnalités pour malvoyants',
          description: 'Ce plan évalue l\'accessibilité et l\'utilité des fonctionnalités pour les personnes ayant une déficience visuelle.',
          disabilityType: 'visual',
          tasks: [
            {
              id: 'task_1',
              title: 'Navigation assistée',
              description: 'Utilisez la navigation pour vous rendre à un point d\'intérêt proche.',
              feature: 'navigation',
              difficulty: 'medium',
              steps: [
                'Activez l\'assistant vocal',
                'Demandez à naviguer vers une pharmacie proche',
                'Suivez les instructions jusqu\'à ce que vous atteigniez la destination'
              ],
              status: TestTaskStatus.NOT_STARTED
            },
            {
              id: 'task_2',
              title: 'Lecture de texte',
              description: 'Utilisez la fonction de reconnaissance de texte pour lire un document.',
              feature: 'text_recognition',
              difficulty: 'easy',
              steps: [
                'Activez la fonction de reconnaissance de texte',
                'Pointez la caméra vers un document',
                'Écoutez la lecture du texte'
              ],
              status: TestTaskStatus.NOT_STARTED
            }
            // Autres tâches...
          ],
          completed: false
        },
        
        // Plan pour personnes à mobilité réduite
        {
          id: 'mobility_impairment_1',
          title: 'Test des fonctionnalités pour mobilité réduite',
          description: 'Ce plan évalue l\'accessibilité des fonctionnalités pour les personnes à mobilité réduite.',
          disabilityType: 'mobility',
          tasks: [
            {
              id: 'task_1',
              title: 'Navigation en mode fauteuil roulant',
              description: 'Utilisez la navigation en mode fauteuil roulant pour trouver un chemin accessible.',
              feature: 'wheelchair_navigation',
              difficulty: 'medium',
              steps: [
                'Activez le mode fauteuil roulant',
                'Définissez une destination',
                'Suivez l\'itinéraire accessible'
              ],
              status: TestTaskStatus.NOT_STARTED
            }
            // Autres tâches...
          ],
          completed: false
        }
        // Autres plans...
      ];
      
      // Charge le plan actif s'il y en a un
      const activePlanJson = await AsyncStorage.getItem('active_test_plan');
      if (activePlanJson) {
        this.activePlan = JSON.parse(activePlanJson);
      }
    } catch (error) {
      console.error('Error loading test plans:', error);
    }
  }
  
  // Obtient les plans disponibles
  public getAvailablePlans(): TestPlan[] {
    return this.availablePlans;
  }
  
  // Démarre un plan de test
  public async startTestPlan(planId: string): Promise<boolean> {
    try {
      const plan = this.availablePlans.find(p => p.id === planId);
      if (!plan) return false;
      
      this.activePlan = {
        ...plan,
        startTime: Date.now(),
        completed: false
      };
      
      await AsyncStorage.setItem('active_test_plan', JSON.stringify(this.activePlan));
      
      this.telemetryService.logUsageEvent(
        'test_plan',
        'start',
        true,
        { planId }
      );
      
      return true;
    } catch (error) {
      console.error('Error starting test plan:', error);
      return false;
    }
  }
  
  // Obtient le plan actif
  public getActivePlan(): TestPlan | null {
    return this.activePlan;
  }
  
  // Démarre une tâche spécifique
  public async startTask(taskId: string): Promise<boolean> {
    if (!this.activePlan) return false;
    
    try {
      const taskIndex = this.activePlan.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return false;
      
      const updatedTasks = [...this.activePlan.tasks];
      updatedTasks[taskIndex] = {
        ...updatedTasks[taskIndex],
        status: TestTaskStatus.IN_PROGRESS,
        startTime: Date.now()
      };
      
      this.activePlan = {
        ...this.activePlan,
        tasks: updatedTasks
      };
      
      await AsyncStorage.setItem('active_test_plan', JSON.stringify(this.activePlan));
      
      this.telemetryService.logUsageEvent(
        'test_task',
        'start',
        true,
        { 
          taskId,
          planId: this.activePlan.id,
          feature: updatedTasks[taskIndex].feature
        }
      );
      
      return true;
    } catch (error) {
      console.error('Error starting task:', error);
      return false;
    }
  }
  
  // Termine une tâche
  public async completeTask(
    taskId: string,
    status: TestTaskStatus.COMPLETED | TestTaskStatus.FAILED | TestTaskStatus.SKIPPED,
    feedback?: { rating: number; comments?: string; difficultyRating?: number }
  ): Promise<boolean> {
    if (!this.activePlan) return false;
    
    try {
      const taskIndex = this.activePlan.tasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1) return false;
      
      const task = this.activePlan.tasks[taskIndex];
      
      const updatedTasks = [...this.activePlan.tasks];
      updatedTasks[taskIndex] = {
        ...task,
        status,
        endTime: Date.now(),
        userFeedback: feedback
      };
      
      this.activePlan = {
        ...this.activePlan,
        tasks: updatedTasks
      };
      
      // Vérifie si toutes les tâches sont terminées
      const allTasksCompleted = updatedTasks.every(t => 
        t.status === TestTaskStatus.COMPLETED || 
        t.status === TestTaskStatus.FAILED ||
        t.status === TestTaskStatus.SKIPPED
      );
      
      if (allTasksCompleted) {
        this.activePlan = {
          ...this.activePlan,
          completed: true,
          endTime: Date.now()
        };
      }
      
      await AsyncStorage.setItem('active_test_plan', JSON.stringify(this.activePlan));
      
      // Durée de la tâche
      const duration = task.startTime ? (Date.now() - task.startTime) / 1000 : undefined;
      
      this.telemetryService.logUsageEvent(
        'test_task',
        'complete',
        status === TestTaskStatus.COMPLETED,
        { 
          taskId,
          planId: this.activePlan.id,
          feature: task.feature,
          status,
          rating: feedback?.rating,
          difficultyRating: feedback?.difficultyRating
        },
        duration
      );
      
      if (allTasksCompleted) {
        this.telemetryService.logUsageEvent(
          'test_plan',
          'complete',
          true,
          { 
            planId: this.activePlan.id,
            disabilityType: this.activePlan.disabilityType
          }
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error completing task:', error);
      return false;
    }
  }
  
  // Réinitialise le plan actif
  public async resetActivePlan(): Promise<boolean> {
    try {
      this.activePlan = null;
      await AsyncStorage.removeItem('active_test_plan');
      return true;
    } catch (error) {
      console.error('Error resetting active plan:', error);
      return false;
    }
  }
  
  // Obtient des statistiques sur les tests
  public getTestStatistics(): Record<string, any> {
    if (!this.activePlan) return {};
    
    const stats = {
      planId: this.activePlan.id,
      title: this.activePlan.title,
      disabilityType: this.activePlan.disabilityType,
      totalTasks: this.activePlan.tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      skippedTasks: 0,
      inProgressTasks: 0,
      notStartedTasks: 0,
      averageRating: 0,
      averageDifficulty: 0
    };
    
    let totalRating = 0;
    let totalDifficulty = 0;
    let ratingCount = 0;
    let difficultyCount = 0;
    
    for (const task of this.activePlan.tasks) {
      switch (task.status) {
        case TestTaskStatus.COMPLETED:
          stats.completedTasks++;
          break;
        case TestTaskStatus.FAILED:
          stats.failedTasks++;
          break;
        case TestTaskStatus.SKIPPED:
          stats.skippedTasks++;
          break;
        case TestTaskStatus.IN_PROGRESS:
          stats.inProgressTasks++;
          break;
        case TestTaskStatus.NOT_STARTED:
          stats.notStartedTasks++;
          break;
      }
      
      if (task.userFeedback?.rating) {
        totalRating += task.userFeedback.rating;
        ratingCount++;
      }
      
      if (task.userFeedback?.difficultyRating) {
        totalDifficulty += task.userFeedback.difficultyRating;
        difficultyCount++;
      }
    }
    
    if (ratingCount > 0) {
      stats.averageRating = totalRating / ratingCount;
    }
    
    if (difficultyCount > 0) {
      stats.averageDifficulty = totalDifficulty / difficultyCount;
    }
    
    return stats;
  }
}