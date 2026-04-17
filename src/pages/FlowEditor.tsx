import { useParams, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  SelectionMode,
  ConnectionLineType,
  type Connection,
  type Node,
  type Edge,
  Panel,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, MessageSquare, Clock, GitFork, Brain, Zap, Play, Pause, RotateCcw, Undo2, Redo2, List } from "lucide-react";
import { useFlow, useFlowNodes, useFlowEdges, useSaveFlowCanvas, useUpdateFlow, useResetFlowExecutions } from "@/hooks/useFlows";
import { Input } from "@/components/ui/input";
import FlowNodeCard from "@/components/flow/FlowNodeCard";
import InsertableEdge from "@/components/flow/InsertableEdge";
import FlowNodeConfigPanel from "@/components/flow/FlowNodeConfigPanel";
import HelperLines from "@/components/flow/HelperLines";
import { useHelperLines } from "@/components/flow/useHelperLines";
import { useUndoRedo } from "@/components/flow/useUndoRedo";
import NodeContextMenu from "@/components/flow/NodeContextMenu";
import EdgeContextMenu from "@/components/flow/EdgeContextMenu";
import InsertNodeMenu from "@/components/flow/InsertNodeMenu";
import { toast } from "sonner";

const nodeCardTypes = [
  { type: "message", label: "Mensagem", icon: MessageSquare, color: "text-blue-500" },
  { type: "delay", label: "Intervalo", icon: Clock, color: "text-amber-500" },
  { type: "condition", label: "Condição", icon: GitFork, color: "text-purple-500" },
  { type: "ai", label: "IA", icon: Brain, color: "text-pink-500" },
  { type: "action", label: "Ação", icon: Zap, color: "text-orange-500" },
  { type: "switch", label: "Switch", icon: List, color: "text-teal-500" },
];

const customNodeTypes = {
  trigger: FlowNodeCard,
  message: FlowNodeCard,
  delay: FlowNodeCard,
  condition: FlowNodeCard,
  ai: FlowNodeCard,
  action: FlowNodeCard,
  switch: FlowNodeCard,
};

export default function FlowEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: flow } = useFlow(id);
  const { data: dbNodes } = useFlowNodes(id);
  const { data: dbEdges } = useFlowEdges(id);
  const saveCanvas = useSaveFlowCanvas();
  const updateFlow = useUpdateFlow();
  const resetExecutions = useResetFlowExecutions();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [flowName, setFlowName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const { helperLineH, helperLineV, applyChangesWithSnap } = useHelperLines();
  const { takeSnapshot, undo, redo, canUndo, canRedo } = useUndoRedo();
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
  const [insertNodeMenu, setInsertNodeMenu] = useState<{ edgeId: string; x: number; y: number; position: { x: number; y: number } } | null>(null);


  // Load from DB
  useEffect(() => {
    if (loaded) return;
    if (!dbNodes || !dbEdges) return;

    const hasNodes = dbNodes.length > 0;

    const rfNodes: Node[] = hasNodes
      ? dbNodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: { x: n.position_x, y: n.position_y },
          data: { config: n.config, type: n.type, flowId: id },
        }))
      : [
          {
            id: crypto.randomUUID(),
            type: "trigger",
            position: { x: 400, y: 80 },
            data: { config: { label: "Início do Fluxo" }, type: "trigger", flowId: id },
          },
        ];

    const rfEdges: Edge[] = dbEdges.map((e) => ({
      id: e.id,
      source: e.source_node_id,
      sourceHandle: e.source_handle || undefined,
      target: e.target_node_id,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
      
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);
    setLoaded(true);
  }, [dbNodes, dbEdges, loaded]);

  useEffect(() => {
    if (flow) setFlowName(flow.name);
  }, [flow]);

  const wouldCreateCycle = useCallback((connection: Connection) => {
    const target = connection.target;
    const source = connection.source;
    if (!target || !source) return false;

    // BFS from target following existing edges to see if we can reach source
    const visited = new Set<string>();
    const queue = [target];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === source) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const edge of edges) {
        if (edge.source === current) {
          queue.push(edge.target);
        }
      }
    }
    return false;
  }, [edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (wouldCreateCycle(connection)) {
        toast.error("Conexão bloqueada: criaria um ciclo no fluxo");
        return;
      }
      takeSnapshot(nodes, edges);
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: crypto.randomUUID(),
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { strokeWidth: 2 },
          },
          eds
        )
      );
    },
    [setEdges, takeSnapshot, nodes, edges, wouldCreateCycle]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onBeforeDelete = useCallback(async ({ nodes: nodesToDelete }: { nodes: Node[]; edges: Edge[] }) => {
    const hasTrigger = nodesToDelete.some((n) => n.type === "trigger");
    if (hasTrigger) {
      toast.error("O node de Início não pode ser excluído");
      return false;
    }
    return true;
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setContextMenu(null);
    setEdgeContextMenu(null);
    setInsertNodeMenu(null);
  }, []);

  // Listen for custom events from InsertableEdge
  useEffect(() => {
    const onInsert = (e: Event) => {
      const { edgeId, clientX, clientY } = (e as CustomEvent).detail;
      setInsertNodeMenu({
        edgeId,
        x: clientX,
        y: clientY,
        position: { x: 0, y: 0 }, // will compute from nodes
      });
    };
    const onCtx = (e: Event) => {
      const { edgeId, clientX, clientY } = (e as CustomEvent).detail;
      setEdgeContextMenu({ edgeId, x: clientX, y: clientY });
    };
    window.addEventListener("flow-edge-insert", onInsert);
    window.addEventListener("flow-edge-context", onCtx);
    return () => {
      window.removeEventListener("flow-edge-insert", onInsert);
      window.removeEventListener("flow-edge-context", onCtx);
    };
  }, []);


  const handleDeleteEdge = useCallback((edgeId: string) => {
    takeSnapshot(nodes, edges);
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [takeSnapshot, nodes, edges, setEdges]);

  const handleInsertNodeBetween = useCallback((type: string) => {
    if (!insertNodeMenu) return;
    const edge = edges.find((e) => e.id === insertNodeMenu.edgeId);
    if (!edge) return;

    takeSnapshot(nodes, edges);

    // Find source and target node positions to place new node in between
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const midX = sourceNode && targetNode
      ? (sourceNode.position.x + targetNode.position.x) / 2
      : insertNodeMenu.position.x;
    const midY = sourceNode && targetNode
      ? (sourceNode.position.y + targetNode.position.y) / 2
      : insertNodeMenu.position.y;

    const newNodeId = crypto.randomUUID();
    const newNode: Node = {
      id: newNodeId,
      type,
      position: { x: midX, y: midY },
      data: { config: {}, type, flowId: id },
    };

    // Remove old edge, add two new edges
    const newEdge1: Edge = {
      id: crypto.randomUUID(),
      source: edge.source,
      sourceHandle: edge.sourceHandle || undefined,
      target: newNodeId,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    };
    const newEdge2: Edge = {
      id: crypto.randomUUID(),
      source: newNodeId,
      target: edge.target,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    };

    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [
      ...eds.filter((e) => e.id !== edge.id),
      newEdge1,
      newEdge2,
    ]);

    setInsertNodeMenu(null);
    toast.success("Node inserido");
  }, [insertNodeMenu, edges, nodes, takeSnapshot, setNodes, setEdges, id]);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
  }, []);

  const handleContextCopy = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    clipboardRef.current = {
      nodes: [JSON.parse(JSON.stringify(node))],
      edges: [],
    };
    toast.success("Node copiado");
  }, [nodes]);

  const handleContextDuplicate = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    takeSnapshot(nodes, edges);
    const newId = crypto.randomUUID();
    const newNode: Node = {
      ...JSON.parse(JSON.stringify(node)),
      id: newId,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      selected: false,
      data: { ...node.data, flowId: id },
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success("Node duplicado");
  }, [nodes, edges, takeSnapshot, setNodes, id]);

  const handleContextRename = useCallback((nodeId: string, newLabel: string) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...(n.data as any).config, label: newLabel } } }
          : n
      )
    );
    setSelectedNode((prev) =>
      prev && prev.id === nodeId
        ? { ...prev, data: { ...prev.data, config: { ...(prev.data as any).config, label: newLabel } } }
        : prev
    );
  }, [setNodes]);

  // Delete selected nodes/edges with Delete/Backspace key - handled by React Flow's deleteKeyCode

  const handleAddNode = (type: string) => {
    takeSnapshot(nodes, edges);
    const newNode: Node = {
      id: crypto.randomUUID(),
      type,
      position: { x: 400, y: (nodes.length + 1) * 150 },
      data: { config: {}, type, flowId: id },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleUpdateNodeConfig = (nodeId: string, config: Record<string, any>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, config } } : n
      )
    );
    setSelectedNode((prev) =>
      prev && prev.id === nodeId ? { ...prev, data: { ...prev.data, config } } : prev
    );
  };

  const handleDeleteNode = (nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node?.type === "trigger") {
      toast.error("O node de Início não pode ser excluído");
      return;
    }
    takeSnapshot(nodes, edges);
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNode?.id === nodeId) setSelectedNode(null);
  };

  const handleSave = async () => {
    if (!id) return;

    if (flowName !== flow?.name) {
      updateFlow.mutate({ id, name: flowName });
    }

    await saveCanvas.mutateAsync({
      flowId: id,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type || "message",
        position_x: n.position.x,
        position_y: n.position.y,
        config: (n.data as any).config || {},
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source_node_id: e.source,
        source_handle: e.sourceHandle || null,
        target_node_id: e.target,
      })),
    });
  };

  const nodeTypes = useMemo(() => customNodeTypes, []);
  const edgeTypes = useMemo(() => ({ default: InsertableEdge }), []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo(nodes, edges, setNodes, setEdges);
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo(nodes, edges, setNodes, setEdges);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length === 0) return;
        const selectedIds = new Set(selectedNodes.map((n) => n.id));
        const selectedEdges = edges.filter((e) => selectedIds.has(e.source) && selectedIds.has(e.target));
        clipboardRef.current = {
          nodes: JSON.parse(JSON.stringify(selectedNodes)),
          edges: JSON.parse(JSON.stringify(selectedEdges)),
        };
        toast.success(`${selectedNodes.length} node(s) copiado(s)`);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) return;
        e.preventDefault();
        takeSnapshot(nodes, edges);

        const idMap = new Map<string, string>();
        const offset = 50;

        const newNodes = clipboardRef.current.nodes.map((n) => {
          const newId = crypto.randomUUID();
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + offset, y: n.position.y + offset },
            selected: true,
            data: { ...n.data, flowId: id },
          };
        });

        const newEdges = clipboardRef.current.edges
          .filter((e) => idMap.has(e.source) && idMap.has(e.target))
          .map((e) => ({
            ...e,
            id: crypto.randomUUID(),
            source: idMap.get(e.source)!,
            target: idMap.get(e.target)!,
            selected: false,
          }));

        // Deselect existing nodes
        setNodes((nds) => [
          ...nds.map((n) => ({ ...n, selected: false })),
          ...newNodes,
        ]);
        setEdges((eds) => [...eds, ...newEdges]);

        // Shift clipboard offset for subsequent pastes
        clipboardRef.current.nodes = clipboardRef.current.nodes.map((n) => ({
          ...n,
          position: { x: n.position.x + offset, y: n.position.y + offset },
        }));

        toast.success(`${newNodes.length} node(s) colado(s)`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nodes, edges, undo, redo, setNodes, setEdges, takeSnapshot, id]);

  // Snapshot on node drag start
  const onNodeDragStart = useCallback(() => {
    takeSnapshot(nodes, edges);
  }, [takeSnapshot, nodes, edges]);

  return (
    <div className="h-[calc(100vh-24px)] -m-6 flex flex-col">
      {/* Header */}
      <div className="h-14 border-b bg-background flex items-center gap-3 px-4 shrink-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate("/flows")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Input
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          className="max-w-[240px] h-8 font-semibold"
        />
        {flow && (
          <Badge variant={flow.status === "active" ? "default" : "secondary"}>
            {flow.status === "active" ? "Ativo" : "Rascunho"}
          </Badge>
        )}
        <div className="flex items-center gap-1 mr-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => undo(nodes, edges, setNodes, setEdges)}
            disabled={!canUndo}
            title="Desfazer (Ctrl+Z)"
            className="h-8 w-8"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => redo(nodes, edges, setNodes, setEdges)}
            disabled={!canRedo}
            title="Refazer (Ctrl+Y)"
            className="h-8 w-8"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex-1" />
        {flow && (
          <Button
            variant={flow.status === "active" ? "outline" : "default"}
            size="sm"
            onClick={() => {
              const newStatus = flow.status === "active" ? "draft" : "active";
              updateFlow.mutate({ id: id!, status: newStatus }, {
                onSuccess: () => toast.success(newStatus === "active" ? "Fluxo ativado!" : "Fluxo desativado"),
              });
            }}
            disabled={updateFlow.isPending}
            className="gap-2"
          >
            {flow.status === "active" ? (
              <><Pause className="w-4 h-4" />Desativar</>
            ) : (
              <><Play className="w-4 h-4" />Ativar</>
            )}
          </Button>
        )}
        <Button
          onClick={() => id && resetExecutions.mutate(id)}
          disabled={resetExecutions.isPending}
          size="sm"
          variant="outline"
          className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
          title="Resetar todas as execuções deste fluxo para testes"
        >
          <RotateCcw className="w-4 h-4" />
          {resetExecutions.isPending ? "Resetando..." : "Resetar"}
        </Button>
        <Button onClick={handleSave} disabled={saveCanvas.isPending} size="sm" variant="outline">
          <Save className="w-4 h-4 mr-2" />
          {saveCanvas.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden relative">

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            connectionLineType={ConnectionLineType.SmoothStep}
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes) => setNodes((nds) => applyChangesWithSnap(changes, nds))}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeDragStart={onNodeDragStart}
            onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onBeforeDelete={onBeforeDelete}
            edgeTypes={edgeTypes}
            nodeTypes={nodeTypes}
            deleteKeyCode={["Delete", "Backspace"]}
            panOnDrag={[1]}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            fitView
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { strokeWidth: 2 },
            }}
          >
            <Background gap={20} size={1} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              className="!bg-background !border-border"
              maskColor="hsl(var(--muted) / 0.7)"
            />
            <HelperLines horizontal={helperLineH} vertical={helperLineV} />
          </ReactFlow>

          {/* Bottom Toolbar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-card border border-border rounded-xl shadow-lg px-2 py-1.5">
            {nodeCardTypes.map((card) => (
              <button
                key={card.type}
                onClick={() => handleAddNode(card.type)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors"
                title={card.label}
              >
                <card.icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-xs font-medium">{card.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Config Panel */}
        {selectedNode && (
          <FlowNodeConfigPanel
            node={selectedNode}
            allNodes={nodes}
            onUpdate={handleUpdateNodeConfig}
            onDelete={handleDeleteNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (() => {
        const node = nodes.find((n) => n.id === contextMenu.nodeId);
        const label = (node?.data as any)?.config?.label || "";
        return (
          <NodeContextMenu
            nodeId={contextMenu.nodeId}
            nodeLabel={label}
            x={contextMenu.x}
            y={contextMenu.y}
            onCopy={handleContextCopy}
            onDuplicate={handleContextDuplicate}
            onRename={handleContextRename}
            onClose={() => setContextMenu(null)}
          />
        );
      })()}

      {/* Edge Context Menu */}
      {edgeContextMenu && (
        <EdgeContextMenu
          edgeId={edgeContextMenu.edgeId}
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          onDelete={handleDeleteEdge}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}

      {/* Insert Node Menu */}
      {insertNodeMenu && (
        <InsertNodeMenu
          x={insertNodeMenu.x}
          y={insertNodeMenu.y}
          onSelect={handleInsertNodeBetween}
          onClose={() => setInsertNodeMenu(null)}
        />
      )}
    </div>
  );
}
