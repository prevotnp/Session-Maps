import type { Express, Request, Response, NextFunction } from "express";
import { storage as dbStorage } from "../storage";
import { isAuthenticated, isAdmin } from "./middleware";

// Middleware: Check enterprise membership
const isEnterpriseMember = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const enterpriseId = parseInt(req.params.enterpriseId);
  if (isNaN(enterpriseId)) return res.status(400).json({ error: "Invalid enterprise ID" });

  // System admins bypass membership check
  if (user.isAdmin) return next();

  const member = await dbStorage.getEnterpriseMember(enterpriseId, user.id);
  if (!member || member.status !== 'active') {
    return res.status(403).json({ error: "Not a member of this enterprise" });
  }
  (req as any).enterpriseMember = member;
  next();
};

const isEnterpriseAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  const enterpriseId = parseInt(req.params.enterpriseId);
  if (isNaN(enterpriseId)) return res.status(400).json({ error: "Invalid enterprise ID" });

  // System admins bypass
  if (user.isAdmin) return next();

  const member = await dbStorage.getEnterpriseMember(enterpriseId, user.id);
  if (!member || member.status !== 'active' || !['owner', 'admin'].includes(member.role)) {
    return res.status(403).json({ error: "Enterprise admin access required" });
  }
  (req as any).enterpriseMember = member;
  next();
};

export function registerEnterpriseRoutes(app: Express) {

  // --- System Admin: Create enterprise ---
  app.post("/api/enterprises", isAdmin, async (req: Request, res: Response) => {
    try {
      const { name, description, maxMembers, ownerUserId } = req.body;
      const user = req.user as any;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: "Enterprise name is required" });
      }

      const slug = name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      const existing = await dbStorage.getEnterpriseBySlug(slug);
      if (existing) {
        return res.status(409).json({ error: "An enterprise with a similar name already exists" });
      }

      const enterprise = await dbStorage.createEnterprise({
        name,
        slug,
        description: description || null,
        maxMembers: maxMembers || 50,
        createdBy: user.id,
      });

      if (ownerUserId) {
        await dbStorage.addEnterpriseMember({
          enterpriseId: enterprise.id,
          userId: ownerUserId,
          role: 'owner',
          invitedBy: user.id,
          status: 'active',
        });
      }

      res.status(201).json(enterprise);
    } catch (error) {
      console.error('Error creating enterprise:', error);
      res.status(500).json({ error: "Failed to create enterprise" });
    }
  });

  // --- System Admin: List all enterprises ---
  app.get("/api/enterprises", isAdmin, async (_req: Request, res: Response) => {
    try {
      const allEnterprises = await dbStorage.getAllEnterprises();
      res.json(allEnterprises);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enterprises" });
    }
  });

  // --- System Admin: Update enterprise ---
  app.put("/api/enterprises/:enterpriseId", isAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const updated = await dbStorage.updateEnterprise(enterpriseId, req.body);
      if (!updated) return res.status(404).json({ error: "Enterprise not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update enterprise" });
    }
  });

  // --- System Admin: Delete enterprise ---
  app.delete("/api/enterprises/:enterpriseId", isAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const deleted = await dbStorage.deleteEnterprise(enterpriseId);
      if (!deleted) return res.status(404).json({ error: "Enterprise not found" });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete enterprise" });
    }
  });

  // --- System Admin: Assign drone image to enterprise ---
  app.post("/api/enterprises/:enterpriseId/drone-images", isAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const { droneImageId } = req.body;
      const user = req.user as any;

      const result = await dbStorage.addEnterpriseDroneImage({
        enterpriseId,
        droneImageId,
        addedBy: user.id,
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign drone image" });
    }
  });

  // --- System Admin: Remove drone image from enterprise ---
  app.delete("/api/enterprises/:enterpriseId/drone-images/:droneImageId", isAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const droneImageId = parseInt(req.params.droneImageId);
      await dbStorage.removeEnterpriseDroneImage(enterpriseId, droneImageId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove drone image" });
    }
  });

  // --- System Admin: Assign Cesium tileset to enterprise ---
  app.post("/api/enterprises/:enterpriseId/cesium-tilesets", isAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const { cesiumTilesetId } = req.body;
      const user = req.user as any;

      const result = await dbStorage.addEnterpriseCesiumTileset({
        enterpriseId,
        cesiumTilesetId,
        addedBy: user.id,
      });
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to assign Cesium tileset" });
    }
  });

  // --- System Admin: Remove Cesium tileset from enterprise ---
  app.delete("/api/enterprises/:enterpriseId/cesium-tilesets/:tilesetId", isAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const tilesetId = parseInt(req.params.tilesetId);
      await dbStorage.removeEnterpriseCesiumTileset(enterpriseId, tilesetId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove Cesium tileset" });
    }
  });

  // --- Any authenticated user: Get my enterprises ---
  app.get("/api/my-enterprises", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const memberships = await dbStorage.getUserEnterprises(user.id);
      res.json(memberships);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enterprises" });
    }
  });

  // --- Enterprise member: Get enterprise details ---
  app.get("/api/enterprises/:enterpriseId/details", isAuthenticated, isEnterpriseMember, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const enterprise = await dbStorage.getEnterprise(enterpriseId);
      if (!enterprise) return res.status(404).json({ error: "Enterprise not found" });

      const members = await dbStorage.getEnterpriseMembers(enterpriseId);
      const droneImagesResult = await dbStorage.getEnterpriseDroneImages(enterpriseId);
      const tilesets = await dbStorage.getEnterpriseCesiumTilesets(enterpriseId);

      res.json({
        ...enterprise,
        members: members.map(m => ({
          id: m.id,
          userId: m.userId,
          username: m.user.username,
          fullName: m.user.fullName,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
        })),
        droneImages: droneImagesResult,
        cesiumTilesets: tilesets,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enterprise details" });
    }
  });

  // --- Enterprise member: Get enterprise drone images ---
  app.get("/api/enterprises/:enterpriseId/drone-images", isAuthenticated, isEnterpriseMember, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const images = await dbStorage.getEnterpriseDroneImages(enterpriseId);
      res.json(images);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enterprise drone images" });
    }
  });

  // --- Enterprise member: Get enterprise Cesium tilesets ---
  app.get("/api/enterprises/:enterpriseId/cesium-tilesets", isAuthenticated, isEnterpriseMember, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const tilesets = await dbStorage.getEnterpriseCesiumTilesets(enterpriseId);
      res.json(tilesets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch enterprise tilesets" });
    }
  });

  // --- Enterprise admin: Get members ---
  app.get("/api/enterprises/:enterpriseId/members", isAuthenticated, isEnterpriseAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const members = await dbStorage.getEnterpriseMembers(enterpriseId);
      res.json(members.map(m => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        fullName: m.user.fullName,
        email: m.user.email,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch members" });
    }
  });

  // --- Enterprise admin: Invite user by username or email ---
  app.post("/api/enterprises/:enterpriseId/members", isAuthenticated, isEnterpriseAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const { identifier, role } = req.body;
      const user = req.user as any;

      let targetUser = await dbStorage.getUserByUsername(identifier);
      if (!targetUser) targetUser = await dbStorage.getUserByEmail(identifier);
      if (!targetUser) return res.status(404).json({ error: "User not found. They need a Session Maps account first." });

      const existing = await dbStorage.getEnterpriseMember(enterpriseId, targetUser.id);
      if (existing) return res.status(409).json({ error: "User is already a member of this enterprise" });

      const enterprise = await dbStorage.getEnterprise(enterpriseId);
      const members = await dbStorage.getEnterpriseMembers(enterpriseId);
      if (enterprise && enterprise.maxMembers && members.length >= enterprise.maxMembers) {
        return res.status(400).json({ error: `Enterprise has reached its member limit (${enterprise.maxMembers})` });
      }

      const member = await dbStorage.addEnterpriseMember({
        enterpriseId,
        userId: targetUser.id,
        role: role || 'member',
        invitedBy: user.id,
        status: 'active',
      });

      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to invite member" });
    }
  });

  // --- Enterprise admin: Update member role ---
  app.put("/api/enterprises/:enterpriseId/members/:memberId", isAuthenticated, isEnterpriseAdmin, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId);
      const { role, status } = req.body;
      const updated = await dbStorage.updateEnterpriseMember(memberId, { role, status });
      if (!updated) return res.status(404).json({ error: "Member not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update member" });
    }
  });

  // --- Enterprise admin: Remove member ---
  app.delete("/api/enterprises/:enterpriseId/members/:memberId", isAuthenticated, isEnterpriseAdmin, async (req: Request, res: Response) => {
    try {
      const memberId = parseInt(req.params.memberId);
      await dbStorage.removeEnterpriseMember(memberId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove member" });
    }
  });

  // --- Enterprise admin: Create invite code ---
  app.post("/api/enterprises/:enterpriseId/invites", isAuthenticated, isEnterpriseAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const user = req.user as any;
      const { maxUses, expiresAt } = req.body;

      const enterprise = await dbStorage.getEnterprise(enterpriseId);
      const prefix = (enterprise?.name || 'ENT').substring(0, 4).toUpperCase().replace(/\s/g, '');
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      const inviteCode = `${prefix}-${randomPart}`;

      const invite = await dbStorage.createEnterpriseInvite({
        enterpriseId,
        inviteCode,
        createdBy: user.id,
        maxUses: maxUses || 50,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      res.status(201).json(invite);
    } catch (error) {
      res.status(500).json({ error: "Failed to create invite" });
    }
  });

  // --- Enterprise admin: List invites ---
  app.get("/api/enterprises/:enterpriseId/invites", isAuthenticated, isEnterpriseAdmin, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const invites = await dbStorage.getEnterpriseInvites(enterpriseId);
      res.json(invites);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });

  // --- Any user: Join enterprise via invite code ---
  app.post("/api/enterprises/join", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { inviteCode } = req.body;
      const user = req.user as any;

      if (!inviteCode || typeof inviteCode !== 'string') {
        return res.status(400).json({ error: "Invite code is required" });
      }

      const invite = await dbStorage.getEnterpriseInviteByCode(inviteCode.trim().toUpperCase());
      if (!invite) return res.status(404).json({ error: "Invalid invite code" });

      if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This invite code has expired" });
      }

      if (invite.maxUses && (invite.usedCount || 0) >= invite.maxUses) {
        return res.status(400).json({ error: "This invite code has reached its usage limit" });
      }

      const existing = await dbStorage.getEnterpriseMember(invite.enterpriseId, user.id);
      if (existing) return res.status(409).json({ error: "You are already a member of this enterprise" });

      const member = await dbStorage.addEnterpriseMember({
        enterpriseId: invite.enterpriseId,
        userId: user.id,
        role: 'member',
        invitedBy: invite.createdBy,
        status: 'active',
      });

      await dbStorage.useEnterpriseInvite(invite.id);

      res.status(201).json({
        member,
        enterprise: invite.enterprise,
        message: `You've joined ${invite.enterprise.name}!`
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to join enterprise" });
    }
  });

  // --- Any user: Leave enterprise ---
  app.post("/api/enterprises/:enterpriseId/leave", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const enterpriseId = parseInt(req.params.enterpriseId);
      const user = req.user as any;

      const member = await dbStorage.getEnterpriseMember(enterpriseId, user.id);
      if (!member) return res.status(404).json({ error: "Not a member" });
      if (member.role === 'owner') return res.status(400).json({ error: "Owners cannot leave. Transfer ownership first or delete the enterprise." });

      await dbStorage.removeEnterpriseMember(member.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to leave enterprise" });
    }
  });
}
