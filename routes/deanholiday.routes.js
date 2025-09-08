const express=require("express");
const router=express.Router();

// Get all holidays
router.get("/holidays",(req,res)=>{const db=req.app.get("db");db.query("SELECT * FROM holiday ORDER BY date DESC",(err,results)=>{if(err)return res.status(500).json({message:"DB error"});res.json(results)})});

// Add a holiday
router.post("/holidays",(req,res)=>{const db=req.app.get("db");const{date,reason}=req.body;if(!date||!reason)return res.status(400).json({message:"Missing fields"});db.query("INSERT INTO holiday (date,reason) VALUES (?,?)",[date,reason],(err,result)=>{if(err)return res.status(500).json({message:"DB error"});res.json({id:result.insertId,date,reason})})});

// Update a holiday
router.put("/holidays/:id",(req,res)=>{const db=req.app.get("db");const{date,reason}=req.body;if(!date||!reason)return res.status(400).json({message:"Missing fields"});db.query("UPDATE holiday SET date=?,reason=? WHERE id=?",[date,reason,req.params.id],(err,result)=>{if(err)return res.status(500).json({message:"DB error"});if(result.affectedRows===0)return res.status(404).json({message:"Holiday not found"});res.json({message:"Holiday updated"})})});

// Delete a holiday
router.delete("/holidays/:id",(req,res)=>{const db=req.app.get("db");db.query("DELETE FROM holiday WHERE id=?",[req.params.id],(err,result)=>{if(err)return res.status(500).json({message:"DB error"});if(result.affectedRows===0)return res.status(404).json({message:"Holiday not found"});res.json({message:"Holiday deleted"})})});

module.exports=router;