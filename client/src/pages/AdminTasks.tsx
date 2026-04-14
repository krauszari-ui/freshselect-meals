import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Loader2, CheckCircle2, Clock, AlertCircle, ListTodo, RefreshCw
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  open: <Clock className="h-4 w-4 text-amber-500" />,
  verified: <AlertCircle className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
};

export default function AdminTasks() {
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newTask, setNewTask] = useState({ description: "", area: "intake_rep" as const, submissionId: "" });

  const tasksQuery = trpc.admin.tasks.list.useQuery({
    status: statusFilter !== "all" ? statusFilter as any : undefined,
  });

  const taskStats = trpc.admin.tasks.stats.useQuery();

  const createTaskMutation = trpc.admin.tasks.create.useMutation({
    onSuccess: () => {
      utils.admin.tasks.list.invalidate();
      utils.admin.tasks.stats.invalidate();
      setShowCreate(false);
      setNewTask({ description: "", area: "intake_rep", submissionId: "" });
      toast.success("Task created");
    },
  });

  const updateStatusMutation = trpc.admin.tasks.updateStatus.useMutation({
    onSuccess: () => {
      utils.admin.tasks.list.invalidate();
      utils.admin.tasks.stats.invalidate();
      toast.success("Task updated");
    },
  });

  const stats = taskStats.data;
  const tasksData = tasksQuery.data as any;
  const tasks = tasksData?.rows ?? tasksData ?? [];

  return (
    <AdminLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
            <p className="text-slate-500 text-sm mt-1">Manage team tasks and follow-ups</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => tasksQuery.refetch()} className="text-slate-500">
              <RefreshCw className={`h-4 w-4 ${tasksQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                  <Plus className="h-4 w-4" /> New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <Input
                    placeholder="Client ID (submission number)"
                    type="number"
                    value={newTask.submissionId}
                    onChange={(e) => setNewTask({ ...newTask, submissionId: e.target.value })}
                  />
                  <Textarea
                    placeholder="Task description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    className="min-h-[80px]"
                  />
                  <Select value={newTask.area} onValueChange={(v: any) => setNewTask({ ...newTask, area: v })}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Area" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="intake_rep">Intake Rep</SelectItem>
                      <SelectItem value="assigned_worker">Assigned Worker</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={!newTask.description.trim() || !newTask.submissionId || createTaskMutation.isPending}
                    onClick={() => createTaskMutation.mutate({
                      submissionId: parseInt(newTask.submissionId),
                      description: newTask.description,
                      area: newTask.area,
                    })}
                  >
                    {createTaskMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Task"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <ListTodo className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                  <p className="text-xs text-slate-500">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-xs text-slate-500">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                  <p className="text-xs text-slate-500">In Progress</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{stats.completed}</p>
                  <p className="text-xs text-slate-500">Completed</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Task List */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            {tasksQuery.isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <ListTodo className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                <p className="text-sm">No tasks found</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tasks.map((task: any) => (
                  <div key={task.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => updateStatusMutation.mutate({
                          id: task.id,
                          status: task.status === "completed" ? "open" : "completed",
                        })}
                        className="shrink-0"
                      >
                        {STATUS_ICONS[task.status] || STATUS_ICONS.pending}
                      </button>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${task.status === "completed" ? "text-slate-400 line-through" : "text-slate-900"}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{task.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {task.dueDate && (
                        <span className="text-xs text-slate-500 hidden sm:inline">
                          {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      <Badge className={`${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium} text-[10px]`}>
                        {task.priority}
                      </Badge>
                      <Select
                        value={task.status}
                        onValueChange={(v) => updateStatusMutation.mutate({ id: task.id, status: v as any })}
                      >
                        <SelectTrigger className="w-[110px] h-7 text-[11px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
